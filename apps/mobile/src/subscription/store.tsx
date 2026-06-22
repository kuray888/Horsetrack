import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from "react";
import { Alert } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Entitlement d'abonnement, global à l'app. Pilote le gating « soft » des
 * visuels/stats (cf. composant <Locked>). Persisté localement en attendant
 * la source de vérité RevenueCat + Supabase.
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
  /** Démarre l'essai 7 jours (à appeler après l'achat RevenueCat réel). */
  startTrial: (plan: SubscriptionPlan) => Promise<void>;
  refresh: () => Promise<void>;
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

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(DEFAULT);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      const parsed: Persisted = raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
      // expiration de l'essai gérée localement (le backend/RevenueCat fera foi ensuite)
      if (parsed.status === "trialing" && parsed.trialEndsAt && !computeIsPremium(parsed)) {
        parsed.status = "expired";
        await SecureStore.setItemAsync(KEY, JSON.stringify(parsed));
      }
      setState(parsed);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startTrial = useCallback(async (plan: SubscriptionPlan) => {
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const next: Persisted = { status: "trialing", plan, trialEndsAt };
    await SecureStore.setItemAsync(KEY, JSON.stringify(next));
    setState(next);
  }, []);

  const value = useMemo<SubscriptionContextValue>(
    () => ({ ...state, isPremium: computeIsPremium(state), loading, startTrial, refresh }),
    [state, loading, startTrial, refresh]
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
 * déclenché par <Locked>) — pour qu'un futur branchement RevenueCat se fasse
 * à un seul endroit plutôt que dans deux copies qui risquent de diverger.
 */
export function useSubscribeFlow() {
  const { startTrial } = useSubscription();
  const [submitting, setSubmitting] = useState(false);

  const subscribe = useCallback(
    async (plan: SubscriptionPlan, onSuccess: () => void | Promise<void>) => {
      setSubmitting(true);
      try {
        // TODO: déclencher l'achat réel via RevenueCat (StoreKit/Play) avant de marquer l'essai.
        await startTrial(plan);
        await onSuccess();
      } catch {
        Alert.alert("Oups", "Impossible de démarrer l'essai. Réessaie.");
      } finally {
        setSubmitting(false);
      }
    },
    [startTrial]
  );

  return { submitting, subscribe };
}
