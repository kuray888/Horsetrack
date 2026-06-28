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
  getPackageForTier,
  isPurchasesAvailable,
  loginRevenueCat,
  logoutRevenueCat,
  type PaidTier,
} from "@/lib/revenuecat";

/**
 * Entitlement d'abonnement, global à l'app. Pilote le gating « soft » des
 * visuels/stats (cf. composant <Locked>) et le gating « dur » du Coach IA /
 * du programme (réservés à Grand Prix).
 *
 * Tant que le projet RevenueCat + les produits store ne sont pas créés
 * (cf. apps/mobile/.env), `isPurchasesAvailable()` reste false et on retombe
 * sur une simulation locale (SecureStore) identique au comportement d'avant
 * — à supprimer une fois les achats réels opérationnels.
 *
 * Valeurs alignées sur les enums Prisma SubscriptionStatus / SubscriptionTier
 * / BillingPeriod (+ 'free' = jamais abonné).
 */
export type SubscriptionStatus = "free" | "trialing" | "active" | "expired" | "cancelled";
export type SubscriptionTier = "FREE" | "PADDOCK" | "GRAND_PRIX";
export type BillingPeriod = "MONTHLY" | "ANNUAL";

/** Nombre de chevaux inclus par palier, avant ajout des add-ons achetés. */
export const HORSE_LIMITS: Record<SubscriptionTier, number> = { FREE: 1, PADDOCK: 2, GRAND_PRIX: 3 };

const KEY = "subscription_state_v1";

type Persisted = {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingPeriod: BillingPeriod | null;
  trialEndsAt: string | null; // ISO
  extraHorseSlots: number;
};

const DEFAULT: Persisted = { tier: "FREE", status: "free", billingPeriod: null, trialEndsAt: null, extraHorseSlots: 0 };

/** Nombre de chevaux autorisés pour un état d'abonnement donné. */
export function maxHorses(s: Pick<Persisted, "tier" | "extraHorseSlots">): number {
  return HORSE_LIMITS[s.tier] + s.extraHorseSlots;
}

type SubscriptionContextValue = Persisted & {
  /** true tant qu'un abonnement Paddock OU Grand Prix (actif ou en essai) couvre le compte. */
  isPremium: boolean;
  isPaddockOrAbove: boolean;
  /** true uniquement pour Grand Prix actif/en essai — gate le Coach IA et le programme. */
  isGrandPrix: boolean;
  loading: boolean;
  /** Démarre l'essai 7 jours Grand Prix en mode simulation locale (utilisé
   * seulement si RevenueCat n'est pas encore configuré, cf. useSubscribeFlow). */
  startTrial: (period: BillingPeriod) => Promise<void>;
  /** Active Paddock immédiatement (pas d'essai sur ce palier), même principe de simulation locale. */
  subscribeToPaddock: (period: BillingPeriod) => Promise<void>;
  /** Active l'add-on "cheval supplémentaire" en simulation locale. */
  activateAddon: () => Promise<void>;
  refresh: () => Promise<void>;
  applyCustomerInfo: (info: CustomerInfo) => void;
  /** Efface l'état d'abonnement local + déconnecte RevenueCat (cf. suppression
   * de compte dans Profil). */
  clearAll: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

function isActiveOrTrialing(s: Pick<Persisted, "status" | "trialEndsAt">): boolean {
  if (s.status === "active") return true;
  if (s.status === "trialing") {
    if (!s.trialEndsAt) return true;
    return new Date(s.trialEndsAt).getTime() > Date.now();
  }
  return false;
}

/** Best-effort : le SKU exact dépend des produits créés dans App Store Connect
 * / Play Console (pas encore le cas) — à remplacer par un mapping exact une
 * fois ces identifiants connus. */
function billingPeriodFromProductId(productId: string): BillingPeriod | null {
  const id = productId.toLowerCase();
  if (id.includes("annual") || id.includes("year")) return "ANNUAL";
  if (id.includes("month")) return "MONTHLY";
  return null;
}

function tierFromActiveEntitlements(active: CustomerInfo["entitlements"]["active"]): SubscriptionTier {
  if (active[ENTITLEMENT_ID.GRAND_PRIX]) return "GRAND_PRIX";
  if (active[ENTITLEMENT_ID.PADDOCK]) return "PADDOCK";
  return "FREE";
}

function persistedFromCustomerInfo(info: CustomerInfo): Persisted {
  const extraHorseSlots = info.entitlements.active[EXTRA_HORSE_ENTITLEMENT_ID] ? 1 : 0;
  const tier = tierFromActiveEntitlements(info.entitlements.active);
  if (tier === "FREE") return { ...DEFAULT, extraHorseSlots };

  // Non-null : tier vient de tierFromActiveEntitlements, qui ne renvoie PADDOCK/GRAND_PRIX
  // que si l'entitlement correspondant est bien présent dans `active`.
  const entitlement = info.entitlements.active[ENTITLEMENT_ID[tier]]!;
  const billingPeriod = billingPeriodFromProductId(entitlement.productIdentifier);
  if (entitlement.periodType === "TRIAL") {
    return { tier, status: "trialing", billingPeriod, trialEndsAt: entitlement.expirationDate, extraHorseSlots };
  }
  return { tier, status: "active", billingPeriod, trialEndsAt: null, extraHorseSlots };
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
    if (parsed.status === "trialing" && parsed.trialEndsAt && !isActiveOrTrialing(parsed)) {
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

  /** Simulation locale (7 jours), utilisée uniquement tant que RevenueCat
   * n'est pas configuré — cf. useSubscribeFlow. Grand Prix est le seul palier
   * avec essai. */
  const startTrial = useCallback(
    async (period: BillingPeriod) => {
      const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await persistLocal({
        tier: "GRAND_PRIX",
        status: "trialing",
        billingPeriod: period,
        trialEndsAt,
        extraHorseSlots: stateRef.current.extraHorseSlots,
      });
    },
    [persistLocal]
  );

  /** Simulation locale : Paddock s'active immédiatement, pas d'essai sur ce palier. */
  const subscribeToPaddock = useCallback(
    async (period: BillingPeriod) => {
      await persistLocal({
        tier: "PADDOCK",
        status: "active",
        billingPeriod: period,
        trialEndsAt: null,
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
      isPremium: state.tier !== "FREE" && isActiveOrTrialing(state),
      isPaddockOrAbove: state.tier !== "FREE" && isActiveOrTrialing(state),
      isGrandPrix: state.tier === "GRAND_PRIX" && isActiveOrTrialing(state),
      loading,
      startTrial,
      subscribeToPaddock,
      activateAddon,
      refresh,
      applyCustomerInfo,
      clearAll,
    }),
    [state, loading, startTrial, subscribeToPaddock, activateAddon, refresh, applyCustomerInfo, clearAll]
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
  const { startTrial, subscribeToPaddock, activateAddon, applyCustomerInfo } = useSubscription();
  const [submitting, setSubmitting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const subscribe = useCallback(
    async (tier: PaidTier, period: BillingPeriod, onSuccess: () => void | Promise<void>) => {
      setSubmitting(true);
      try {
        if (!isPurchasesAvailable()) {
          // RevenueCat pas encore configuré (.env vide) : simulation locale,
          // identique au comportement avant le branchement RevenueCat.
          if (tier === "GRAND_PRIX") await startTrial(period);
          else await subscribeToPaddock(period);
          await onSuccess();
          return;
        }

        const pkg = await getPackageForTier(tier, period);
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
    [startTrial, subscribeToPaddock, applyCustomerInfo]
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
      const hasEntitlement = tierFromActiveEntitlements(info.entitlements.active) !== "FREE";
      Alert.alert(hasEntitlement ? "Abonnement restauré" : "Rien à restaurer", hasEntitlement ? "" : "Aucun achat actif trouvé pour ce compte.");
    } catch {
      Alert.alert("Oups", "Impossible de restaurer tes achats.");
    } finally {
      setRestoring(false);
    }
  }, [applyCustomerInfo]);

  return { submitting, subscribe, purchaseAddon, restoring, restore };
}
