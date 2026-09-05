import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/resend";

const schema = z.object({
  horseId: z.string().min(1),
  invitedEmail: z.string().email(),
  role: z.enum(["DEMI_PENSION", "COACH", "RIDER", "GROOM"]),
});

const ROLE_LABEL: Record<"DEMI_PENSION" | "COACH" | "RIDER" | "GROOM", string> = {
  DEMI_PENSION: "en demi-pension",
  COACH: "en tant que coach",
  RIDER: "en tant que cavalier·ère additionnel·le",
  GROOM: "en tant que lad/palefrenier",
};

/**
 * Envoie l'email prévenant l'invité d'un partage de cheval (cf.
 * lib/sharing.ts inviteCollaborator côté mobile, qui a déjà créé la ligne
 * horse_collaborators avant d'appeler cette route). Sans cet appel, l'invité
 * ne découvrait le partage que s'il ouvrait l'app avec le même email un jour
 * — cf. audit produit du 2026-09-03. Best-effort comme le reste des emails
 * (cron de rappels) : un échec d'envoi ne doit jamais faire échouer
 * l'invitation elle-même côté mobile (la ligne existe déjà en base).
 *
 * Prend `horseId` (pas un `horseName` fourni par le client, cf. audit du
 * 2026-09-04) : le nom du cheval est lu ici en base, et son appartenance à
 * l'appelant authentifié est vérifiée avant tout envoi — sans ça, n'importe
 * quel compte authentifié pouvait faire partir un email d'invitation pour un
 * cheval qu'il ne possède pas (la ligne horse_collaborators réelle, elle,
 * reste de toute façon protégée par RLS ailleurs, mais rien n'empêchait
 * l'envoi de cet email-ci en amont).
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
  const { horseId, invitedEmail, role } = parsed.data;

  const horse = await db.horse.findUnique({
    where: { id: horseId },
    select: { name: true, owner: { select: { userId: true } } },
  });
  if (!horse || horse.owner.userId !== userId) {
    return NextResponse.json({ error: "Cheval introuvable" }, { status: 403 });
  }

  const inviter = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  const inviterName = inviter?.name || inviter?.email || "Un cavalier";

  const subject = `${inviterName} vous invite à suivre ${horse.name} sur Horsetrack`;
  const bodyText = [
    `${inviterName} vous invite à accéder au suivi de ${horse.name} sur Horsetrack, ${ROLE_LABEL[role]}.`,
    "",
    "Pour accepter : installe Horsetrack et connecte-toi (ou crée un compte) avec cette adresse email — l'invitation apparaîtra automatiquement à l'ouverture de l'app.",
    "",
    "Si tu ne t'attendais pas à ce message, tu peux l'ignorer sans risque.",
  ].join("\n");

  const sent = await sendEmail(invitedEmail, subject, bodyText);
  return NextResponse.json({ sent });
}
