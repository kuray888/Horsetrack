/**
 * Logique pure de l'abonnement — séparée de store.tsx (qui importe
 * react-native/expo-secure-store/supabase) pour rester testable en isolation
 * avec vitest, sans avoir à mocker tout le runtime natif.
 */

export type SubscriptionStatus = "free" | "trialing" | "active" | "expired" | "cancelled";
export type BillingPeriod = "MONTHLY" | "ANNUAL";

/** Chevaux inclus au palier gratuit — doit rester synchronisé avec
 * `effective_horse_limit` côté rls.sql (branche "else 1"). */
export const FREE_HORSE_LIMIT = 1;

export type Persisted = {
  status: SubscriptionStatus;
  billingPeriod: BillingPeriod | null;
  trialEndsAt: string | null; // ISO
};

export const DEFAULT_SUBSCRIPTION_STATE: Persisted = {
  status: "free",
  billingPeriod: null,
  trialEndsAt: null,
};

export function computeIsActiveOrTrialing(s: Pick<Persisted, "status" | "trialEndsAt">): boolean {
  if (s.status === "active") return true;
  if (s.status === "trialing") {
    if (!s.trialEndsAt) return false;
    return new Date(s.trialEndsAt).getTime() > Date.now();
  }
  return false;
}

/** Nombre de chevaux autorisés pour un état d'abonnement donné — 1 en
 * gratuit, illimité en Premium (actif ou en essai, cf. pivot produit du
 * 2026-09-05 : plus de quota de 3 ni d'add-on "cheval supplémentaire"). Doit
 * rester synchronisé avec `effective_horse_limit` côté rls.sql. */
export function maxHorses(s: Pick<Persisted, "status" | "trialEndsAt">): number {
  return computeIsActiveOrTrialing(s) ? Infinity : FREE_HORSE_LIMIT;
}
