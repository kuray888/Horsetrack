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
  /** Premium offert depuis RevenueCat (ambassadeurs, `store: "PROMOTIONAL"`) :
   * aucun abonnement store derrière, rien à gérer ni à acheter. */
  promotional?: boolean;
  /** Formule payante : « pro » quand l'entitlement Écurie Pro est actif
   * (absent des états enregistrés avant Écurie Pro : Premium). */
  plan?: "premium" | "pro";
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

/** Écurie Pro en cours (actif ou en essai). */
export function computeIsPro(s: Pick<Persisted, "status" | "trialEndsAt" | "plan">): boolean {
  return computeIsActiveOrTrialing(s) && s.plan === "pro";
}

/** Personnes avec qui chaque cheval peut être partagé — doit rester aligné sur
 * `horse_collaborator_limit` (packages/db/prisma/rls.sql). */
export function collaboratorLimit(s: Pick<Persisted, "status" | "trialEndsAt" | "plan">): number {
  return computeIsPro(s) ? 5 : 1;
}

/** Nombre de chevaux autorisés pour un état d'abonnement donné — 1 en
 * gratuit, illimité en Premium (actif ou en essai, cf. pivot produit du
 * 2026-09-05 : plus de quota de 3 ni d'add-on "cheval supplémentaire"). Doit
 * rester synchronisé avec `effective_horse_limit` côté rls.sql. */
export function maxHorses(s: Pick<Persisted, "status" | "trialEndsAt">): number {
  return computeIsActiveOrTrialing(s) ? Infinity : FREE_HORSE_LIMIT;
}
