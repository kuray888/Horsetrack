import { useEffect } from "react";
import { AppState } from "react-native";
import { useSubscription } from "./store";
import { syncTrialLifecycle } from "./trialLifecycle";

/** Rend rien : resynchronise les rappels de l'essai (cf. trialLifecycle.ts)
 * à chaque changement d'état d'abonnement et à chaque retour au premier plan
 * (autorisation de notification accordée entre-temps, email à retenter). */
export function TrialLifecycleSync() {
  const { loading, status, trialEndsAt, billingPeriod } = useSubscription();

  useEffect(() => {
    if (loading) return;
    const state = { status, trialEndsAt, billingPeriod };
    void syncTrialLifecycle(state);
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void syncTrialLifecycle(state);
    });
    return () => sub.remove();
  }, [loading, status, trialEndsAt, billingPeriod]);

  return null;
}
