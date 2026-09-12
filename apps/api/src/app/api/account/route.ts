import { NextRequest, NextResponse } from "next/server";
import { Prisma, db } from "@cheval/db";
import { deleteSupabaseAuthUser, getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/resend";

/** Suppression de compte (exigée par la guideline App Store 5.1.1(v)) — supprime
 * d'abord les données Prisma (cascade : rider_profiles, horses, traits,
 * blessures, goals, sessions), puis le compte Supabase Auth. */
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

  // Lu avant la suppression : le cascade Horse→HorseCollaborator (cf.
  // schema.prisma) va couper l'accès de tout collaborateur ACCEPTED sur un
  // cheval que ce compte possédait, sans jamais les en prévenir — ils ne le
  // découvraient qu'au prochain sync, le cheval ayant juste disparu (cf.
  // audit du 2026-09-12 : même angle mort que la révocation manuelle). Email
  // best-effort envoyé après coup, une fois la suppression confirmée.
  const affectedCollaborators = await db.horseCollaborator.findMany({
    where: { horse: { owner: { userId } }, status: "ACCEPTED" },
    select: { invitedEmail: true, horse: { select: { name: true } } },
  });

  try {
    await db.user.delete({ where: { id: userId } });
  } catch (e) {
    const alreadyDeleted = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025";
    if (alreadyDeleted) {
      // ok, on continue vers la suppression Supabase Auth
    } else {
      console.error("[account:delete] échec suppression Prisma", e);
      const fkViolation = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003";
      return NextResponse.json(
        {
          error: fkViolation
            ? "Suppression bloquée par des données liées à ton compte — contacte le support."
            : "Erreur serveur lors de la suppression de tes données.",
        },
        { status: 500 }
      );
    }
  }

  for (const c of affectedCollaborators) {
    sendEmail(
      c.invitedEmail,
      `Ton accès à ${c.horse.name} sur Horsetrack a été retiré`,
      [
        `Le compte propriétaire de ${c.horse.name} a été supprimé sur Horsetrack, ce qui met fin à ton accès partagé à ce cheval.`,
        "",
        "Si tu penses qu'il s'agit d'une erreur, rapproche-toi directement de cette personne.",
      ].join("\n")
    ).catch(() => {});
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
