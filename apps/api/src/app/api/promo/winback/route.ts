import { NextRequest, NextResponse } from "next/server";
import { db, PromoKind } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { describeDiscount, pickWinbackOffer } from "@/lib/promoRules";

/**
 * Offre de retour proposée à ce compte, s'il y en a une — lecture seule.
 *
 * Une offre de retour est un code « Remise sur l'abonnement » créé dans
 * /admin avec la campagne « retour » (en pratique réservé aux anciens
 * abonnés). L'app l'affiche aux comptes gratuits ; l'utiliser passe par
 * /api/promo/redeem, comme tout code : c'est Apple qui affiche le prix et
 * facture. Rien n'est écrit ici, et seuls le code et sa description sortent.
 */
export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const rider = await db.riderProfile.findUnique({
    where: { userId },
    select: { id: true, subscriptionStatus: true, trialEndsAt: true, revenuecatId: true, createdAt: true },
  });
  if (!rider) return NextResponse.json({ offer: null });

  const promos = await db.promoCode.findMany({
    where: { kind: PromoKind.STORE_OFFER, active: true, campaign: { not: null } },
    select: {
      id: true,
      code: true,
      kind: true,
      campaign: true,
      description: true,
      discountType: true,
      discountValue: true,
      active: true,
      startsAt: true,
      expiresAt: true,
      eligibility: true,
      maxAccountAgeDays: true,
      maxRedemptions: true,
      _count: { select: { redemptions: true } },
      redemptions: { where: { riderId: rider.id }, select: { status: true }, take: 1 },
    },
  });

  const offer = pickWinbackOffer(
    promos.map((p) => ({
      ...p,
      redemptionCount: p._count.redemptions,
      ownRedemptionStatus: p.redemptions[0]?.status ?? null,
    })),
    rider,
    new Date()
  );
  if (!offer) return NextResponse.json({ offer: null });

  const promo = promos.find((p) => p.id === offer.id)!;
  return NextResponse.json(
    {
      offer: {
        code: offer.code,
        headline: describeDiscount(promo.discountType, promo.discountValue),
        description: promo.description,
        expiresAt: offer.expiresAt?.toISOString() ?? null,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
