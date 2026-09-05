import { NextRequest, NextResponse } from "next/server";
import { db } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";

/**
 * Indique si un email correspond déjà à un compte Horsetrack — utilisé avant
 * de créer une invitation de partage (cf. lib/sharing.ts inviteCollaborator),
 * pour ne jamais inviter quelqu'un qui ne pourra jamais découvrir
 * l'invitation (cf. audit produit du 2026-09-03 : avant, l'invité n'était
 * prévenu que s'il se trouvait déjà avoir un compte avec cet email).
 * Authentification requise pour éviter d'exposer un endpoint d'énumération
 * de comptes ouvert à quiconque.
 */
export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Paramètre email manquant" }, { status: 400 });
  }

  // findFirst + mode "insensitive" plutôt que findUnique : Supabase Auth ne
  // garantit pas que l'email stocké soit déjà en minuscules (dépend du
  // provider — Apple Sign-In notamment), donc une comparaison stricte
  // risquerait un faux négatif.
  const user = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  return NextResponse.json({ exists: !!user });
}
