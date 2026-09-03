/**
 * Logique pure de l'abonnement — séparée de store.tsx (qui importe
 * react-native/expo-secure-store/supabase) pour rester testable en isolation
 * avec vitest, sans avoir à mocker tout le runtime natif.
 */

export type SubscriptionStatus = "free" | "trialing" | "active" | "expired" | "cancelled";
export type BillingPeriod = "MONTHLY" | "ANNUAL";

/** Nombre de chevaux inclus par l'abonnement, avant ajout des add-ons achetés. */
export const HORSE_LIMIT = 3;

export type Persisted = {
  status: SubscriptionStatus;
  billingPeriod: BillingPeriod | null;
  trialEndsAt: string | null; // ISO
  extraHorseSlots: number;
};

export const DEFAULT_SUBSCRIPTION_STATE: Persisted = {
  status: "free",
  billingPeriod: null,
  trialEndsAt: null,
  extraHorseSlots: 0,
};

/** Nombre de chevaux autorisés pour un état d'abonnement donné. */
export function maxHorses(s: Pick<Persisted, "extraHorseSlots">): number {
  return HORSE_LIMIT + s.extraHorseSlots;
}

export function computeIsActiveOrTrialing(s: Pick<Persisted, "status" | "trialEndsAt">): boolean {
  if (s.status === "active") return true;
  if (s.status === "trialing") {
    if (!s.trialEndsAt) return false;
    return new Date(s.trialEndsAt).getTime() > Date.now();
  }
  return false;
}
