import { NextRequest, NextResponse } from "next/server";
import { db } from "@cheval/db";
import { isPremiumNow } from "@/lib/promoRules";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/resend";
import { MAX_STARTS_PER_DAY, generateShareToken, publicBaseUrl, startEmail, startSchema } from "@/lib/rideSafety";

/**
 * Départ d'une balade suivie (Premium) : crée le lien de suivi et l'envoie
 * aux proches choisis. Cf. lib/rideSafety.ts pour le fonctionnement complet.
 */
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const parsed = startSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const profile = await db.riderProfile.findUnique({
    where: { userId },
    select: { subscriptionStatus: true, trialEndsAt: true },
  });
  if (!profile || !isPremiumNow(profile, new Date())) {
    return NextResponse.json({ error: "La sécurité en balade est réservée aux comptes Premium." }, { status: 403 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60_000);
  const recent = await db.rideShare.count({ where: { userId, createdAt: { gte: since } } });
  if (recent >= MAX_STARTS_PER_DAY) {
    return NextResponse.json({ error: "Trop de balades suivies aujourd'hui." }, { status: 429 });
  }

  const { riderName, horseName, contacts, lat, lng } = parsed.data;
  const token = generateShareToken();
  const hasPosition = lat !== undefined && lng !== undefined;
  await db.rideShare.create({
    data: {
      id: token,
      userId,
      riderName,
      horseName,
      contacts,
      lastLat: hasPosition ? lat : null,
      lastLng: hasPosition ? lng : null,
      lastPointAt: hasPosition ? new Date() : null,
    },
  });

  const viewUrl = `${publicBaseUrl(req.url)}/suivi/${token}`;
  const email = startEmail({ riderName, horseName, viewUrl });
  const results = await Promise.all(contacts.map((c) => sendEmail(c.email, email.subject, email.body).catch(() => false)));

  return NextResponse.json({ token, viewUrl, emailsSent: results.filter(Boolean).length });
}
