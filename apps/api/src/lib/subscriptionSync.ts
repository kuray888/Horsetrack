import { db, SubscriptionStatus } from "@cheval/db";
import type { EntitlementState } from "@/lib/revenuecatApi";

export type SyncOutcome = "granted" | "downgraded" | "unchanged" | "no-profile";

/**
 * Recopie dans rider_profiles l'état Premium lu chez RevenueCat (cf.
 * lib/revenuecatApi.ts fetchEntitlementState).
 *
 * - Accès en cours → écrit tel quel (même forme que le webhook, cf.
 *   lib/revenuecatEntitlement.ts). `no-profile` si la ligne n'existe pas
 *   encore : à l'appelant de réessayer plus tard.
 * - Aucun accès → ne rétrograde QUE si `allowDowngrade`, et seulement un accès
 *   venu de RevenueCat : ACTIVE, ou essai store (TRIALING avec revenuecatId).
 *   Un essai offert par code promo (/api/promo/redeem) n'existe pas chez
 *   RevenueCat : il ne doit jamais être effacé par cette relecture.
 *
 * `lastWebhookEventAt` passe à maintenant : l'état écrit est celui de
 * RevenueCat à cet instant, un webhook plus ancien livré en retard ne doit pas
 * l'écraser (même garde que dans le webhook).
 */
export async function applyEntitlementState(
  userId: string,
  state: EntitlementState,
  options: { allowDowngrade: boolean }
): Promise<SyncOutcome> {
  const now = new Date();
  if (state.active) {
    const { count } = await db.riderProfile.updateMany({
      where: { userId },
      data: { ...state.grant, revenuecatId: userId, lastWebhookEventAt: now },
    });
    return count > 0 ? "granted" : "no-profile";
  }
  if (!options.allowDowngrade) return "unchanged";
  const { count } = await db.riderProfile.updateMany({
    where: {
      userId,
      OR: [
        { subscriptionStatus: SubscriptionStatus.ACTIVE },
        { subscriptionStatus: SubscriptionStatus.TRIALING, revenuecatId: { not: null } },
      ],
    },
    data: { subscriptionStatus: SubscriptionStatus.EXPIRED, lastWebhookEventAt: now },
  });
  return count > 0 ? "downgraded" : "unchanged";
}
