/**
 * Paliers payants et ce qu'ils ouvrent côté serveur — source unique pour le
 * webhook RevenueCat, la relecture RevenueCat et les quotas du coach.
 *
 * RevenueCat : les produits Écurie Pro sont rattachés AUX DEUX entitlements
 * (`grand_prix` ET `ecurie_pro`) — tout ce qui est Premium reste donc ouvert
 * à un compte Pro sans rien changer ailleurs ; `ecurie_pro` ne fait
 * qu'ajouter le palier PRO.
 */
export const PREMIUM_ENTITLEMENT_ID = "grand_prix";
export const PRO_ENTITLEMENT_ID = "ecurie_pro";

export type PaidTier = "GRAND_PRIX" | "PRO";

/** Palier ouvert par une liste d'entitlements actifs, ou null si aucun. */
export function tierFromEntitlementIds(ids: readonly string[]): PaidTier | null {
  if (ids.includes(PRO_ENTITLEMENT_ID)) return "PRO";
  if (ids.includes(PREMIUM_ENTITLEMENT_ID)) return "GRAND_PRIX";
  return null;
}

/** Personnes avec qui un cheval peut être partagé — doit rester aligné sur
 * `horse_collaborator_limit` (packages/db/prisma/rls.sql). */
export const COLLABORATORS_PER_HORSE: Record<PaidTier, number> = { GRAND_PRIX: 1, PRO: 5 };
