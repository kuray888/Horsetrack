import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { MAX_NOTIFIED_COMMENTS_PER_HOUR, commentPushMessages, threadParticipants } from "@/lib/communityPush";

const schema = z.object({ commentId: z.string().min(1).max(64) });

/**
 * Après un commentaire (écrit par l'app directement dans Supabase, RLS) :
 * prévient les autres participants du fil par notification push (Expo,
 * gratuit). Le serveur relit le commentaire et vérifie que l'appelant en
 * est l'auteur : l'app ne choisit ni les destinataires ni le texte.
 */
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  const comment = await db.horseComment.findUnique({
    where: { id: parsed.data.commentId },
    select: {
      authorUserId: true,
      body: true,
      targetType: true,
      targetId: true,
      createdAt: true,
      horse: {
        select: {
          id: true,
          name: true,
          owner: { select: { userId: true } },
          collaborators: { where: { status: "ACCEPTED" }, select: { collaboratorUserId: true } },
        },
      },
    },
  });
  if (!comment || comment.authorUserId !== userId) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  // Seulement un commentaire tout juste écrit : pas de relance d'un ancien.
  if (Date.now() - comment.createdAt.getTime() > 10 * 60_000) return NextResponse.json({ sent: 0 });

  const recent = await db.horseComment.count({ where: { authorUserId: userId, createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
  if (recent > MAX_NOTIFIED_COMMENTS_PER_HOUR) return NextResponse.json({ sent: 0 });

  const participants = threadParticipants(
    comment.horse.owner.userId,
    comment.horse.collaborators.map((c) => c.collaboratorUserId),
    userId
  );
  if (participants.length === 0) return NextResponse.json({ sent: 0 });
  const recipients = await db.pushToken.findMany({ where: { userId: { in: participants } }, select: { token: true, userId: true, lang: true } });

  const messages = commentPushMessages({
    recipients,
    horseId: comment.horse.id,
    horseName: comment.horse.name,
    targetType: comment.targetType === "journal" ? "journal" : "session",
    targetId: comment.targetId,
    body: comment.body,
  });
  if (messages.length === 0) return NextResponse.json({ sent: 0 });

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  }).catch(() => null);

  // Jetons désinstallés : retirés, pour ne plus les solliciter.
  const json = (await res?.json().catch(() => null)) as { data?: { status: string; details?: { error?: string } }[] } | null;
  const dead = (json?.data ?? [])
    .map((r, i) => (r.status === "error" && r.details?.error === "DeviceNotRegistered" ? messages[i].to : null))
    .filter((t): t is string => !!t);
  if (dead.length) await db.pushToken.deleteMany({ where: { token: { in: dead } } });

  return NextResponse.json({ sent: res?.ok ? messages.length - dead.length : 0 });
}
