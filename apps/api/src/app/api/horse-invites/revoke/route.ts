import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/resend";

const schema = z.object({
  horseId: z.string().min(1),
  invitedEmail: z.string().email(),
});

/**
 * Prévient un ex-collaborateur (ou invité encore PENDING) que son accès à un
 * cheval vient d'être retiré. Sans cet appel, la seule façon de s'en rendre
 * compte était que le cheval disparaisse silencieusement à la prochaine
 * synchro (cf. audit du 2026-09-12 : révocation muette côté partage). La
 * ligne horse_collaborators est déjà supprimée côté mobile au moment de cet
 * appel (cf. lib/sharing.ts revokeCollaborator, protégé par la policy RLS
 * horse_collaborators_owner_delete) — cette route ne fait donc que vérifier
 * la possession du cheval avant d'envoyer l'email, best-effort comme le reste
 * des emails (un échec d'envoi ne doit jamais bloquer la révocation elle-même,
 * déjà effective côté base à ce stade).
 */
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { horseId, invitedEmail } = parsed.data;

  const horse = await db.horse.findUnique({
    where: { id: horseId },
    select: { name: true, owner: { select: { userId: true } } },
  });
  if (!horse || horse.owner.userId !== userId) {
    return NextResponse.json({ error: "Cheval introuvable" }, { status: 403 });
  }

  const subject = `Ton accès à ${horse.name} sur Horsetrack a été retiré`;
  const bodyText = [
    `Le propriétaire de ${horse.name} vient de retirer ton accès partagé à ce cheval sur Horsetrack.`,
    "",
    "Si tu penses qu'il s'agit d'une erreur, rapproche-toi directement de cette personne — une nouvelle invitation te redonnera accès.",
  ].join("\n");

  const sent = await sendEmail(invitedEmail, subject, bodyText);
  return NextResponse.json({ sent });
}
