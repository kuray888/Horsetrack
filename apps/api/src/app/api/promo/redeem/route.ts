import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, SubscriptionStatus } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";

const schema = z.object({ code: z.string().min(1).max(64) });

/**
 * Rédemption d'un code promo — validation et application EXCLUSIVEMENT ici,
 * jamais sur la seule foi d'une valeur envoyée par le mobile (cf. audit
 * sécurité du 2026-09-05). Réutilise le mécanisme d'essai Premium déjà
 * existant (subscriptionStatus=TRIALING + trialEndsAt, cf. rls.sql
 * rider_is_active_or_trialing) plutôt qu'un nouveau statut ou un produit
 * RevenueCat : un code valide prolonge `trialEndsAt`, exactement comme un
 * essai gratuit normal — la connexion Prisma directe (DATABASE_URL) permet
 * cette écriture en bypassant `protect_rider_profile_entitlements` (réservé
 * aux écritures via auth.uid(), cf. rls.sql), même chemin de confiance que le
 * webhook RevenueCat.
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
  const code = parsed.data.code.trim().toUpperCase();

  const riderProfile = await db.riderProfile.findUnique({
    where: { userId },
    select: { id: true, subscriptionStatus: true, trialEndsAt: true },
  });
  if (!riderProfile) {
    return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });
  }

  const promo = await db.promoCode.findUnique({ where: { code } });
  if (!promo || !promo.active) {
    return NextResponse.json({ error: "Ce code promo n'existe pas ou n'est plus valide." }, { status: 404 });
  }
  if (promo.expiresAt && promo.expiresAt < new Date()) {
    return NextResponse.json({ error: "Ce code promo a expiré." }, { status: 410 });
  }
  // Un abonné déjà actif/en essai n'a rien à gagner (et surtout ne doit
  // jamais voir un vrai abonnement payant écrasé par un trialEndsAt de code
  // promo, potentiellement plus court) — on enregistre quand même la
  // rédemption pour ne pas laisser le code réutilisable indéfiniment par ce
  // compte une fois son abonnement expiré.
  const alreadyPremium =
    riderProfile.subscriptionStatus === SubscriptionStatus.ACTIVE ||
    (riderProfile.subscriptionStatus === SubscriptionStatus.TRIALING &&
      !!riderProfile.trialEndsAt &&
      riderProfile.trialEndsAt > new Date());

  // Comptage + enregistrement dans UNE transaction verrouillée sur le code :
  // sans verrou, deux utilisations simultanées lisaient chacune le compteur
  // avant que l'autre ne l'incrémente, et dépassaient maxRedemptions.
  const outcome = await db.$transaction(async (tx) => {
    await tx.$executeRaw`select pg_advisory_xact_lock(hashtextextended(${`promo:${promo.id}`}, 0))`;
    if (promo.maxRedemptions !== null) {
      const redemptionCount = await tx.promoCodeRedemption.count({ where: { promoCodeId: promo.id } });
      if (redemptionCount >= promo.maxRedemptions) return "limit" as const;
    }
    // Vérifié AVANT l'insertion plutôt que via l'erreur d'unicité : une erreur
    // SQL invalide toute la transaction Postgres. Sûr grâce au verrou
    // ci-dessus (même code ⇒ requêtes sérialisées).
    const existing = await tx.promoCodeRedemption.findFirst({
      where: { promoCodeId: promo.id, riderId: riderProfile.id },
      select: { id: true },
    });
    if (existing) return "already" as const;
    await tx.promoCodeRedemption.create({ data: { promoCodeId: promo.id, riderId: riderProfile.id } });
    return "ok" as const;
  });
  if (outcome === "limit") {
    return NextResponse.json({ error: "Ce code promo a atteint sa limite d'utilisation." }, { status: 410 });
  }
  if (outcome === "already") {
    return NextResponse.json({ error: "Tu as déjà utilisé ce code promo." }, { status: 409 });
  }

  if (alreadyPremium) {
    return NextResponse.json({
      applied: false,
      message: "Tu profites déjà de Horsetrack Premium — code enregistré, merci !",
    });
  }

  const trialEndsAt = new Date(Date.now() + promo.premiumDays * 24 * 60 * 60 * 1000);
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
