import { SubscriptionStatus, SubscriptionTier } from "@cheval/db";

/** Le Coach IA et l'éclairage IA du programme (cf. /api/coach,
 * /api/program-insight) sont tous les deux réservés au palier Grand Prix —
 * partagé pour que les deux routes restent cohérentes entre elles. */
export function isGrandPrixRider(
  rider: { subscriptionTier: SubscriptionTier; subscriptionStatus: SubscriptionStatus; trialEndsAt: Date | null } | null
): boolean {
  if (!rider) return false;
  if (rider.subscriptionTier !== SubscriptionTier.GRAND_PRIX) return false;
  if (rider.subscriptionStatus === SubscriptionStatus.ACTIVE) return true;
  if (rider.subscriptionStatus === SubscriptionStatus.TRIALING) {
    // trialEndsAt manquant = essai non confirmé par RevenueCat : refuser,
    // jamais accorder l'accès par défaut (cf. audit sécurité — combiné au
    // défaut GRAND_PRIX/TRIALING de rider_profiles, ce fail-open donnait un
    // accès Grand Prix illimité et gratuit à tout nouveau compte).
    return rider.trialEndsAt !== null && rider.trialEndsAt.getTime() > Date.now();
  }
  return false;
}
