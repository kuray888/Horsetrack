import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from "react";
import { Alert } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { CustomerInfo } from "react-native-purchases";
import { supabase } from "@/lib/supabase";
import {
  ENTITLEMENT_ID,
  Purchases,
  configurePurchases,
  getPackageForPlan,
  isPurchasesAvailable,
  loginRevenueCat,
  logoutRevenueCat,
} from "@/lib/revenuecat";

/**
 * Entitlement d'abonnement, global à l'app. Pilote le gating « soft » des
 * visuels/stats (cf. composant <Locked>).
 *
 * Tant que le projet RevenueCat + les produits store ne sont pas créés
 * (cf. apps/mobile/.env), `isPurchasesAvailable()` reste false et on retombe
 * sur une simulation locale (SecureStore) identique au comportement d'avant
 * — à supprimer une fois les achats réels opérationnels.
 *
 * Valeurs alignées sur l'enum Prisma SubscriptionStatus (+ 'free' = jamais abonné).
 */
export type SubscriptionStatus = "free" | "trialing" | "active" | "expired" | "cancelled";
export type SubscriptionPlan = "MONTHLY" | "ANNUAL";

const KEY = "subscription_state_v1";

type Persisted = {
  status: SubscriptionStatus;
  plan: SubscriptionPlan | null;
  trialEndsAt: string | null; // ISO
};

const DEFAULT: Persisted = { status: "free", plan: null, trialEndsAt: null };

type SubscriptionContextValue = Persisted & {
  /** true tant que l'essai/abo donne accès au premium. */
  isPremium: boolean;
  loading: boolean;
  /** Démarre l'essai 7 jours en mode simulation locale (utilisé seulement si
   * RevenueCat n'est pas encore configuré, cf. useSubscribeFlow). */
  startTrial: (plan: SubscriptionPlan) => Promise<void>;
  refresh: () => Promise<void>;
  applyCustomerInfo: (info: CustomerInfo) => void;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

function computeIsPremium(s: Persisted): boolean {
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
function planFromProductId(productId: string): SubscriptionPlan | null {
  const id = productId.toLowerCase();
  if (id.includes("annual") || id.includes("year")) return "ANNUAL";
  if (id.includes("month")) return "MONTHLY";
  return null;
}

function persistedFromCustomerInfo(info: CustomerInfo): Persisted {
  const entitlement = info.entitlements.active[ENTITLEMENT_ID];
  if (!entitlement) return DEFAULT;

  const plan = planFromProductId(entitlement.productIdentifier);
  if (entitlement.periodType === "TRIAL") {
    return { status: "trialing", plan, trialEndsAt: entitlement.expirationDate };
  }
  return { status: "active", plan, trialEndsAt: null };
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(DEFAULT);
  const [loading, setLoading] = useState(true);

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
    const parsed: Persisted = raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
    // expiration de l'essai simulé gérée localement
    if (parsed.status === "trialing" && parsed.trialEndsAt && !computeIsPremium(parsed)) {
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
        loginRevenueCat(session.user.id).then(refreshFromRevenueCat);
      } else if (event === "SIGNED_OUT") {
        logoutRevenueCat().then(() => persistLocal(DEFAULT));
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh, refreshFromRevenueCat, persistLocal]);

  /** Simulation locale (7 jours), utilisée uniquement tant que RevenueCat
   * n'est pas configuré — cf. useSubscribeFlow. */
  const startTrial = useCallback(
    async (plan: SubscriptionPlan) => {
      const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await persistLocal({ status: "trialing", plan, trialEndsAt });
    },
    [persistLocal]
  );

  const value = useMemo<SubscriptionContextValue>(
    () => ({ ...state, isPremium: computeIsPremium(state), loading, startTrial, refresh, applyCustomerInfo }),
    [state, loading, startTrial, refresh, applyCustomerInfo]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription doit être utilisé dans <SubscriptionProvider>");
  return ctx;
}

/**
 * Logique d'achat partagée par les deux écrans paywall (onboarding et celui
 * déclenché par <Locked>), pour qu'elle ne soit écrite qu'à un seul endroit.
 */
export function useSubscribeFlow() {
  const { startTrial, applyCustomerInfo } = useSubscription();
  const [submitting, setSubmitting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const subscribe = useCallback(
    async (plan: SubscriptionPlan, onSuccess: () => void | Promise<void>) => {
      setSubmitting(true);
      try {
        if (!isPurchasesAvailable()) {
          // RevenueCat pas encore configuré (.env vide) : simulation locale,
          // identique au comportement avant le branchement RevenueCat.
          await startTrial(plan);
          await onSuccess();
          return;
        }

        const pkg = await getPackageForPlan(plan);
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

  return { submitting, subscribe, restoring, restore };
}
