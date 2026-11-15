import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { setCoachConsent } from "@/lib/coach/store";

/**
 * Accord (ou retrait) pour l'envoi du carnet à l'IA du coach. L'app l'appelle
 * quand l'utilisateur coche ou décoche la carte de consentement, et renvoie
 * l'accord déjà donné sur l'appareil quand le serveur répond 428. Un retrait
 * coupe immédiatement toutes les routes du coach (cf. lib/coach/store.ts).
 */
const bodySchema = z.object({ granted: z.boolean() });

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  const done = await setCoachConsent(userId, parsed.data.granted);
  if (!done) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true, granted: parsed.data.granted });
}
