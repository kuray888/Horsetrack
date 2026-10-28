import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, PromoKind, PromoRedemptionStatus, SubscriptionStatus } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { checkPromoAvailability, isPremiumNow, normalizePromoCode, storeRedeemUrl } from "@/lib/promoRules";

const schema = z.object({
  code: z.string().min(1).max(64),
  // Absent sur les versions de l'app antérieures aux codes d'offre store.
  platform: z.enum(["ios", "android"]).optional(),
});

/** Identifiant App Store public de Horsetrack (cf. apps/mobile/eas.json). */
const APP_STORE_ID = process.env.APP_STORE_ID ?? "6786889092";

/**
 * Rédemption d'un code promo — validation et application EXCLUSIVEMENT ici,
 * jamais sur la seule foi d'une valeur envoyée par le mobile (cf. audit
 * sécurité du 2026-09-05). Règles pures dans lib/promoRules.ts.
 *
 * PREMIUM_DAYS : réutilise le mécanisme d'essai Premium déjà existant
 * (subscriptionStatus=TRIALING + trialEndsAt, cf. rls.sql
 * rider_is_active_or_trialing) plutôt qu'un nouveau statut ou un produit
 * RevenueCat — la connexion Prisma directe (DATABASE_URL) permet cette
 * écriture en bypassant `protect_rider_profile_entitlements` (réservé aux
 * écritures via auth.uid(), cf. rls.sql), même chemin de confiance que le
 * webhook RevenueCat.
 *
 * STORE_OFFER : aucune écriture d'abonnement ici. On vérifie les conditions
 * propres à Horsetrack, on enregistre la tentative pour le suivi, et on
 * renvoie l'adresse de rédemption du store : c'est Apple/Google qui affiche le
 * prix remisé et facture. La conversion est constatée plus tard par le webhook
 * RevenueCat (offer_code, cf. lib/promoConversion.ts).
 */
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Code invalide." }, { status: 400 });
  }
  const code = normalizePromoCode(parsed.data.code);
  const platform = parsed.data.platform ?? "ios";

  const riderProfile = await db.riderProfile.findUnique({
    where: { userId },
    select: { id: true, subscriptionStatus: true, trialEndsAt: true, revenuecatId: true, createdAt: true },
  });
  if (!riderProfile) {
    return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });
  }

  const promo = await db.promoCode.findUnique({ where: { code } });
  if (!promo) {
    // `unknown` : l'app peut proposer de saisir le code directement dans
    // l'App Store (codes d'offre à usage unique générés par Apple, qu'on ne
    // connaît pas).
    return NextResponse.json(
      { error: "Ce code promo n'existe pas ou n'est plus valide.", unknown: true },
      { status: 404 }
    );
  }
  const now = new Date();
  const availability = checkPromoAvailability(promo, riderProfile, now);
  if (!availability.ok) {
    return NextResponse.json({ error: availability.error }, { status: availability.status });
  }

  const isStoreOffer = promo.kind === PromoKind.STORE_OFFER;
  // Un abonné déjà actif/en essai n'a rien à gagner d'un code « jours
  // Premium » (et surtout ne doit jamais voir un vrai abonnement payant écrasé
  // par un trialEndsAt de code promo, potentiellement plus court) — on
  // enregistre quand même la rédemption pour ne pas laisser le code
  // réutilisable indéfiniment par ce compte une fois son abonnement expiré.
  const alreadyPremium = !isStoreOffer && isPremiumNow(riderProfile, now);

  // Comptage + enregistrement dans UNE transaction verrouillée sur le code :
  // sans verrou, deux utilisations simultanées lisaient chacune le compteur
  // avant que l'autre ne l'incrémente, et dépassaient maxRedemptions.
  const outcome = await db.$transaction(async (tx) => {
    await tx.$executeRaw`select pg_advisory_xact_lock(hashtextextended(${`promo:${promo.id}`}, 0))`;
    // Vérifié AVANT l'insertion plutôt que via l'erreur d'unicité : une erreur
    // SQL invalide toute la transaction Postgres. Sûr grâce au verrou
    // ci-dessus (même code ⇒ requêtes sérialisées).
    const existing = await tx.promoCodeRedemption.findFirst({
      where: { promoCodeId: promo.id, riderId: riderProfile.id },
      select: { status: true },
    });
    if (existing) {
      // Offre store abandonnée sur la feuille Apple : on peut la rouvrir
      // autant de fois que nécessaire, sans consommer une nouvelle place.
      if (isStoreOffer && existing.status === PromoRedemptionStatus.STORE_REDIRECTED) return "reopen" as const;
      return "already" as const;
    }
    if (promo.maxRedemptions !== null) {
      const redemptionCount = await tx.promoCodeRedemption.count({ where: { promoCodeId: promo.id } });
      if (redemptionCount >= promo.maxRedemptions) return "limit" as const;
    }
    const status = isStoreOffer
      ? PromoRedemptionStatus.STORE_REDIRECTED
      : alreadyPremium
        ? PromoRedemptionStatus.ALREADY_PREMIUM
        : PromoRedemptionStatus.APPLIED;
    await tx.promoCodeRedemption.create({ data: { promoCodeId: promo.id, riderId: riderProfile.id, status } });
    return "ok" as const;
  });
  if (outcome === "limit") {
    return NextResponse.json({ error: "Ce code promo a atteint sa limite d'utilisation." }, { status: 410 });
  }
  if (outcome === "already") {
    return NextResponse.json({ error: "Tu as déjà utilisé ce code promo." }, { status: 409 });
  }

  if (isStoreOffer) {
    const store = platform === "android" ? "Google Play" : "l'App Store";
    return NextResponse.json({
      applied: false,
      kind: "store_offer",
      redeemUrl: storeRedeemUrl(platform, promo.storeOfferCode ?? promo.code, APP_STORE_ID),
      message: promo.description
        ? `${promo.description} — confirme l'offre sur ${store}.`
        : `Code valide : ${store} va t'afficher l'offre et son prix avant toute confirmation.`,
    });
  }

  if (alreadyPremium) {
    return NextResponse.json({
      applied: false,
      message: "Tu profites déjà de Horsetrack Premium — code enregistré, merci !",
    });
  }

  const trialEndsAt = new Date(now.getTime() + promo.premiumDays * 24 * 60 * 60 * 1000);
  await db.riderProfile.update({
    where: { id: riderProfile.id },
    data: { subscriptionStatus: SubscriptionStatus.TRIALING, trialEndsAt },
  });

  return NextResponse.json({
    applied: true,
    trialEndsAt: trialEndsAt.toISOString(),
    message: promo.description || `${promo.premiumDays} jours de Premium offerts !`,
  });
}
