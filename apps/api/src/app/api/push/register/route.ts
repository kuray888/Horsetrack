import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { isExpoPushToken } from "@/lib/communityPush";

const schema = z.object({
  token: z.string().max(200),
  platform: z.enum(["ios", "android"]),
  lang: z.enum(["fr", "en"]),
});

/**
 * Jeton de notification push de l'appareil, rattaché au compte connecté.
 * Un même téléphone qui change de compte change de propriétaire de jeton :
 * l'ancien compte ne reçoit plus ses notifications.
 */
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isExpoPushToken(parsed.data.token)) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  const { token, platform, lang } = parsed.data;
  await db.pushToken.upsert({ where: { token }, create: { token, userId, platform, lang }, update: { userId, platform, lang } });
  return NextResponse.json({ ok: true });
}

/** Déconnexion : l'appareil ne reçoit plus rien pour ce compte. */
export async function DELETE(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const token = req.nextUrl.searchParams.get("token") ?? "";
  await db.pushToken.deleteMany({ where: { token, userId } });
  return NextResponse.json({ ok: true });
}
