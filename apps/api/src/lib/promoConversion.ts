import { db, PromoRedemptionStatus } from "@cheval/db";
import { normalizePromoCode } from "@/lib/promoRules";

/**
 * Achat store fait avec un code d'offre (champ `offer_code` des événements
 * RevenueCat) : marque la rédemption du code Horsetrack correspondant comme
 * convertie, pour le suivi admin. Crée la ligne si le code a été saisi
 * directement dans l'App Store, sans passer par l'app.
 *
 * Purement statistique : n'accorde ni ne retire jamais rien (l'accès vient de
 * l'entitlement RevenueCat, traité par le webhook). Best-effort — ne rejette
 * jamais, pour ne pas faire échouer le webhook.
 */
export async function recordOfferCodeConversion(userId: string, offerCode: string, at: Date): Promise<void> {
  try {
    const code = normalizePromoCode(offerCode);
    if (!code) return;
    const promo = await db.promoCode.findFirst({
      where: { OR: [{ code }, { storeOfferCode: { equals: code, mode: "insensitive" } }] },
      select: { id: true },
    });
    if (!promo) return;
    const rider = await db.riderProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!rider) return;
    const key = { promoCodeId_riderId: { promoCodeId: promo.id, riderId: rider.id } };
    const existing = await db.promoCodeRedemption.findUnique({ where: key, select: { convertedAt: true } });
    // Les renouvellements suivants portent le même offer_code : seule la
    // première conversion compte.
    if (existing?.convertedAt) return;
    await db.promoCodeRedemption.upsert({
      where: key,
      create: {
        promoCodeId: promo.id,
        riderId: rider.id,
        status: PromoRedemptionStatus.CONVERTED,
        convertedAt: at,
      },
      update: { status: PromoRedemptionStatus.CONVERTED, convertedAt: at },
    });
  } catch (e) {
    console.warn("[promo] conversion offer_code non enregistrée", e);
  }
}
