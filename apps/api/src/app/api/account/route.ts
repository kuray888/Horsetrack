import { NextRequest, NextResponse } from "next/server";
import { Prisma, db } from "@cheval/db";
import { deleteSupabaseAuthUser, getUserIdFromRequest } from "@/lib/supabaseAdmin";

/** Suppression de compte (exigée par la guideline App Store 5.1.1(v)) — supprime
 * d'abord les données Prisma (cascade : rider_profiles, horses, traits,
 * blessures, goals, coach_usage, sessions), puis le compte Supabase Auth. */
export async function DELETE(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // horse_collaborators.collaboratorUserId n'a pas de FK vers users (cf.
  // schema.prisma) — un cavalier invité comme demi-pension/coach n'a pas à
  // exister côté Prisma pour qu'on puisse créer la ligne avant qu'il accepte.
  // Pas couvert par le cascade de db.user.delete ci-dessous : à nettoyer à la
  // main, sinon le propriétaire du cheval garde un slot de partage occupé par
  // un compte qui n'existe plus (la limite d'1 collaborateur/cheval ne se
  // libère jamais sans ça).
  await db.horseCollaborator.deleteMany({ where: { collaboratorUserId: userId } });

  try {
    await db.user.delete({ where: { id: userId } });
  } catch (e) {
    const alreadyDeleted = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025";
    if (!alreadyDeleted) throw e;
  }

  const { error } = await deleteSupabaseAuthUser(userId);
  if (error) {
    return NextResponse.json(
      { error: "Tes données ont été supprimées, mais la fermeture du compte a échoué — réessaie." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
