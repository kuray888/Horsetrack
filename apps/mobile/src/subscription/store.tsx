import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, ReactNode } from "react";
import { Alert } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { CustomerInfo } from "react-native-purchases";
import { supabase } from "@/lib/supabase";
import { safeJsonParse } from "@/lib/safeJsonParse";
import {
  ENTITLEMENT_ID,
  EXTRA_HORSE_ENTITLEMENT_ID,
  Purchases,
  configurePurchases,
  getAddonPackage,
  getSubscriptionPackage,
  isPurchasesAvailable,
  loginRevenueCat,
  logoutRevenueCat,
} from "@/lib/revenuecat";
import {
  DEFAULT_SUBSCRIPTION_STATE as DEFAULT,
  computeIsActiveOrTrialing,
  HORSE_LIMIT,
  maxHorses,
} from "./logic";
import type { SubscriptionStatus, BillingPeriod, Persisted } from "./logic";

/**
 * Entitlement d'abonnement, global à l'app. Pilote le gating de toute l'app
 * (cf. composant <Locked>) — depuis le pivot tarifaire du 2026-09-03, un seul
 * palier payant existe, donc plus de notion de tier ici : soit le compte est
 * actif/en essai, soit il ne l'est pas (lecture seule, cf. rls.sql
 * rider_is_active_or_trialing).
 *
 * Tant que le projet RevenueCat + les produits store ne sont pas créés
 * (cf. apps/mobile/.env), `isPurchasesAvailable()` reste false et on retombe
 * sur une simulation locale (SecureStore) identique au comportement d'avant
 * — à supprimer une fois les achats réels opérationnels.
 *
 * Valeurs alignées sur l'enum Prisma SubscriptionStatus / BillingPeriod
 * (+ 'free' = jamais abonné). La logique pure (calcul du statut effectif,
 * limite de chevaux) vit dans ./logic.ts, testée séparément.
 */
export type { SubscriptionStatus, BillingPeriod, Persisted };
export { HORSE_LIMIT, maxHorses, computeIsActiveOrTrialing };

const KEY = "subscription_state_v1";

type SubscriptionContextValue = Persisted & {
  /** true tant qu'un abonnement (actif ou en essai) couvre le compte — seul
   * gate de toute l'app depuis le pivot vers un palier unique. */
  isActiveOrTrialing: boolean;
  loading: boolean;
  /** Démarre l'essai de 2 mois en mode simulation locale (utilisé seulement
   * si RevenueCat n'est pas encore configuré, cf. useSubscribeFlow). */
  startTrial: (period: BillingPeriod) => Promise<void>;
  /** Active l'add-on "cheval supplémentaire" en simulation locale. */
  activateAddon: () => Promise<void>;
  refresh: () => Promise<void>;
  applyCustomerInfo: (info: CustomerInfo) => void;
  /** Efface l'état d'abonnement local + déconnecte RevenueCat (cf. suppression
   * de compte dans Profil). */
  clearAll: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

/** Best-effort : le SKU exact dépend des produits créés dans App Store Connect
 * / Play Console (pas encore le cas) — à remplacer par un mapping exact une
 * fois ces identifiants connus. */
function billingPeriodFromProductId(productId: string): BillingPeriod | null {
  const id = productId.toLowerCase();
  if (id.includes("annual") || id.includes("year")) return "ANNUAL";
  if (id.includes("month")) return "MONTHLY";
  return null;
}

function persistedFromCustomerInfo(info: CustomerInfo): Persisted {
  const extraHorseSlots = info.entitlements.active[EXTRA_HORSE_ENTITLEMENT_ID] ? 1 : 0;
  const entitlement = info.entitlements.active[ENTITLEMENT_ID];
  if (!entitlement) return { ...DEFAULT, extraHorseSlots };

  const billingPeriod = billingPeriodFromProductId(entitlement.productIdentifier);
  if (entitlement.periodType === "TRIAL") {
    return { status: "trialing", billingPeriod, trialEndsAt: entitlement.expirationDate, extraHorseSlots };
  }
  return { status: "active", billingPeriod, trialEndsAt: null, extraHorseSlots };
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(DEFAULT);
  const [loading, setLoading] = useState(true);
  // Lu par les actions de simulation locale pour ne pas écraser des champs
  // qu'elles ne modifient pas elles-mêmes (ex: garder extraHorseSlots lors
  // d'un changement de palier) sans dépendre d'un `state` figé dans leur closure.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const persistLocal = useCallback(async (next: Persisted) => {
    await SecureStore.setItemAsync(KEY, JSON.stringify(next));
    setState(next);
  }, []);

  const applyCustomerInfo = useCallback(
    (info: CustomerInfo) => {
      persistLocal(persistedFromCustomerInfo(info));
    },
    [persistLocal]
  );

  const refreshFromRevenueCat = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) await loginRevenueCat(data.user.id);
    // Non-null : on n'arrive ici que si isPurchasesAvailable() est true (cf. refresh()).
    const info = await Purchases!.getCustomerInfo();
    applyCustomerInfo(info);
  }, [applyCustomerInfo]);

  const refreshFromLocalCache = useCallback(async () => {
    const raw = await SecureStore.getItemAsync(KEY);
    const parsed: Persisted = { ...DEFAULT, ...safeJsonParse<Partial<Persisted>>(raw, {}) };
    // expiration de l'essai simulé gérée localement
    if (parsed.status === "trialing" && parsed.trialEndsAt && !computeIsActiveOrTrialing(parsed)) {
      parsed.status = "expired";
      await SecureStore.setItemAsync(KEY, JSON.stringify(parsed));
    }
    setState(parsed);
  }, []);

  const refresh = useCallback(async () => {
    try {
      configurePurchases();
      if (isPurchasesAvailable()) {
        await refreshFromRevenueCat();
      } else {
        await refreshFromLocalCache();
      }
    } finally {
      setLoading(false);
    }
  }, [refreshFromRevenueCat, refreshFromLocalCache]);

  useEffect(() => {
    refresh();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isPurchasesAvailable()) return;
      if (event === "SIGNED_IN" && session?.user) {
        loginRevenueCat(session.user.id)
          .then(refreshFromRevenueCat)
          .catch((e) => console.warn("[subscription] loginRevenueCat/refresh échoué", e));
      } else if (event === "SIGNED_OUT") {
        logoutRevenueCat()
          .then(() => persistLocal(DEFAULT))
          .catch((e) => console.warn("[subscription] logoutRevenueCat échoué", e));
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh, refreshFromRevenueCat, persistLocal]);

  /** Simulation locale (2 mois), utilisée uniquement tant que RevenueCat
   * n'est pas configuré — cf. useSubscribeFlow. */
  const startTrial = useCallback(
    async (period: BillingPeriod) => {
      const trialEndsAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
      await persistLocal({
        status: "trialing",
        billingPeriod: period,
        trialEndsAt,
        extraHorseSlots: stateRef.current.extraHorseSlots,
      });
    },
    [persistLocal]
  );

  const activateAddon = useCallback(async () => {
    await persistLocal({ ...stateRef.current, extraHorseSlots: 1 });
  }, [persistLocal]);

  const clearAll = useCallback(async () => {
    if (isPurchasesAvailable()) await logoutRevenueCat();
    await SecureStore.deleteItemAsync(KEY);
    setState(DEFAULT);
  }, []);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      ...state,
      isActiveOrTrialing: computeIsActiveOrTrialing(state),
      loading,
      startTrial,
      activateAddon,
      refresh,
      applyCustomerInfo,
      clearAll,
    }),
    [state, loading, startTrial, activateAddon, refresh, applyCustomerInfo, clearAll]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription doit être utilisé dans <SubscriptionProvider>");
  return ctx;
}

/**
 * Logique d'achat partagée par les écrans paywall (onboarding et celui
 * déclenché par <Locked>), pour qu'elle ne soit écrite qu'à un seul endroit.
 */
export function useSubscribeFlow() {
  const { startTrial, activateAddon, applyCustomerInfo } = useSubscription();
  const [submitting, setSubmitting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const subscribe = useCallback(
    async (period: BillingPeriod, onSuccess: () => void | Promise<void>) => {
      setSubmitting(true);
      try {
        if (!isPurchasesAvailable()) {
          // RevenueCat pas encore configuré (.env vide) : simulation locale,
          // identique au comportement avant le branchement RevenueCat.
          await startTrial(period);
          await onSuccess();
          return;
        }

        const pkg = await getSubscriptionPackage(period);
        if (!pkg) {
          Alert.alert("Indisponible", "Cette offre n'est pas encore configurée. Réessaie plus tard.");
          return;
        }
        // Non-null : isPurchasesAvailable() a déjà été vérifié plus haut dans ce bloc.
        const { customerInfo } = await Purchases!.purchasePackage(pkg);
        applyCustomerInfo(customerInfo);
        await onSuccess();
      } catch (e) {
        if ((e as { userCancelled?: boolean })?.userCancelled) return;
        Alert.alert("Oups", "Impossible de finaliser l'achat. Réessaie.");
      } finally {
        setSubmitting(false);
      }
    },
    [startTrial, applyCustomerInfo]
  );

  const purchaseAddon = useCallback(
    async (period: BillingPeriod, onSuccess: () => void | Promise<void>) => {
      setSubmitting(true);
      try {
        if (!isPurchasesAvailable()) {
          await activateAddon();
          await onSuccess();
          return;
        }

        const pkg = await getAddonPackage(period);
        if (!pkg) {
          Alert.alert("Indisponible", "Cette offre n'est pas encore configurée. Réessaie plus tard.");
          return;
        }
        const { customerInfo } = await Purchases!.purchasePackage(pkg);
        applyCustomerInfo(customerInfo);
        await onSuccess();
      } catch (e) {
        if ((e as { userCancelled?: boolean })?.userCancelled) return;
        Alert.alert("Oups", "Impossible de finaliser l'achat. Réessaie.");
      } finally {
        setSubmitting(false);
      }
    },
    [activateAddon, applyCustomerInfo]
  );

  const restore = useCallback(async () => {
    if (!isPurchasesAvailable()) {
      Alert.alert("Indisponible", "La restauration des achats sera possible une fois les abonnements activés.");
      return;
    }
    setRestoring(true);
    try {
      // Non-null : isPurchasesAvailable() vérifié juste au-dessus.
      const info = await Purchases!.restorePurchases();
      applyCustomerInfo(info);
      const hasEntitlement = !!info.entitlements.active[ENTITLEMENT_ID];
      Alert.alert(hasEntitlement ? "Abonnement restauré" : "Rien à restaurer", hasEntitlement ? "" : "Aucun achat actif trouvé pour ce compte.");
    } catch {
      Alert.alert("Oups", "Impossible de restaurer tes achats.");
    } finally {
      setRestoring(false);
    }
  }, [applyCustomerInfo]);

  return { submitting, subscribe, purchaseAddon, restoring, restore };
}
