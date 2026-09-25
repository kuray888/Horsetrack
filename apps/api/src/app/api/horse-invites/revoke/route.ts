import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/resend";
import { safeLine } from "@/lib/emailSafety";

const schema = z.object({
  horseId: z.string().min(1),
  /** Ligne horse_collaborators à révoquer. */
  collaboratorId: z.string().min(1).optional(),
  /** Ancien contrat (versions de l'app antérieures au 2026-09-25) : l'email
   * venait du client, qui avait déjà supprimé la ligne — accepté mais plus
   * JAMAIS utilisé pour envoyer quoi que ce soit (cf. ci-dessous). */
  invitedEmail: z.string().email().optional(),
});

/**
 * Révoque un partage de cheval ET prévient l'ex-collaborateur.
 *
 * La suppression se fait ici, côté serveur, avant l'email : on n'écrit qu'à
 * l'adresse ENREGISTRÉE pour ce partage. Avant, le mobile supprimait la ligne
 * puis envoyait l'email à révoquer ; cette route ne vérifiait que la
 * possession du cheval et écrivait à l'adresse fournie — n'importe quel
 * propriétaire pouvait faire envoyer « ton accès a été retiré » à n'importe
 * qui, en boucle.
 */
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { horseId, collaboratorId } = parsed.data;

  const horse = await db.horse.findUnique({
    where: { id: horseId },
    select: { name: true, owner: { select: { userId: true } } },
  });
  if (!horse || horse.owner.userId !== userId) {
    return NextResponse.json({ error: "Cheval introuvable" }, { status: 403 });
  }

  // Ancien contrat : plus d'email vers une adresse fournie par le client.
  if (!collaboratorId) return NextResponse.json({ sent: false });

  const collaborator = await db.horseCollaborator.findFirst({
    where: { id: collaboratorId, horseId },
    select: { id: true, invitedEmail: true },
  });
  if (!collaborator) {
    // Déjà révoqué (double appui, autre appareil) : rien à faire.
    return NextResponse.json({ revoked: false, sent: false });
  }
  await db.horseCollaborator.delete({ where: { id: collaborator.id } });

  const horseName = safeLine(horse.name, 60) || "ce cheval";
  const subject = `Ton accès à ${horseName} sur Horsetrack a été retiré`;
  const bodyText = [
    `Le propriétaire de ${horseName} vient de retirer ton accès partagé à ce cheval sur Horsetrack.`,
    "",
    "Si tu penses qu'il s'agit d'une erreur, rapproche-toi directement de cette personne — une nouvelle invitation te redonnera accès.",
  ].join("\n");

  const sent = await sendEmail(collaborator.invitedEmail, subject, bodyText);
  return NextResponse.json({ revoked: true, sent });
}
