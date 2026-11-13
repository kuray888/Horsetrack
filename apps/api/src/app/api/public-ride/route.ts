import { NextRequest, NextResponse } from "next/server";
import { db } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { generateShareToken, isShareToken, publicBaseUrl } from "@/lib/rideSafety";
import { MAX_PUBLIC_RIDES_PER_DAY, publicRideSchema } from "@/lib/publicRide";

/**
 * Lien public d'une séance (cf. lib/publicRide.ts). Gratuit, comme la séance.
 * POST : crée le lien (remplace celui de la même séance). DELETE ?token= :
 * le supprime — la page /s/<jeton> n'existe plus aussitôt.
 */
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const parsed = publicRideSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Séance invalide" }, { status: 400 });
  const { sessionId, route, ...rest } = parsed.data;

  const since = new Date(Date.now() - 24 * 60 * 60_000);
  const recent = await db.publicRide.count({ where: { userId, createdAt: { gte: since } } });
  if (recent >= MAX_PUBLIC_RIDES_PER_DAY) {
    return NextResponse.json({ error: "Trop de liens créés aujourd'hui." }, { status: 429 });
  }

  const token = generateShareToken();
  // Un seul lien par séance : en recréer un (autre choix de masquage) remplace l'ancien.
  if (sessionId) await db.publicRide.deleteMany({ where: { userId, sessionId } });
  await db.publicRide.create({
    data: { id: token, userId, sessionId: sessionId ?? null, route: route ?? null, ...rest, startedAt: new Date(rest.startedAt) },
  });
  return NextResponse.json({ token, url: `${publicBaseUrl(req.url)}/s/${token}` });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!isShareToken(token)) return NextResponse.json({ error: "Lien invalide" }, { status: 400 });
  // Seul le propriétaire supprime ; un lien déjà supprimé n'est pas une erreur.
  await db.publicRide.deleteMany({ where: { id: token, userId } });
  return NextResponse.json({ ok: true });
}
