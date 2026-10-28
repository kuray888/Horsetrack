import { db } from "@cheval/db";
import { MAX_REWARDS_PER_YEAR, isPaidConversionEvent, rewardEndTime } from "@/lib/referrals";
import { fetchEntitlementExpiry, grantPromotionalUntil } from "@/lib/revenuecatApi";

/**
 * Appelé par le webhook RevenueCat sur un événement du filleul : à son
 * premier vrai paiement, le parrain reçoit un mois de Premium offert.
 * Best-effort : un échec ne doit jamais faire échouer le webhook (l'abonnement
 * du filleul passe avant). Claim atomique sur `rewardedAt` : un événement
 * rejoué ne récompense pas deux fois.
 */
export async function rewardReferrerIfDue(
  refereeUserId: string,
  event: { type?: string; period_type?: string; store?: string }
): Promise<void> {
  if (!isPaidConversionEvent(event)) return;
  const use = await db.referralUse.findUnique({ where: { refereeUserId } });
  if (!use || use.rewardedAt) return;

  const since = new Date(Date.now() - 365 * 86_400_000);
  const recent = await db.referralUse.count({
    where: { referrerUserId: use.referrerUserId, rewardedAt: { gte: since } },
  });
  const now = new Date();
  const claim = await db.referralUse.updateMany({
    where: { refereeUserId, rewardedAt: null },
    data: { rewardedAt: now },
  });
  if (claim.count === 0) return;
  // Plafond atteint : le filleul est compté comme récompensé, sans octroi.
  if (recent >= MAX_REWARDS_PER_YEAR) return;

  const expiry = await fetchEntitlementExpiry(use.referrerUserId);
  const granted = await grantPromotionalUntil(use.referrerUserId, rewardEndTime(expiry ?? null, now));
  if (!granted) {
    // Octroi raté (RevenueCat indisponible) : la récompense est remise en jeu,
    // le prochain renouvellement du filleul la retentera.
    await db.referralUse.updateMany({ where: { refereeUserId, rewardedAt: now }, data: { rewardedAt: null } });
  }
}
