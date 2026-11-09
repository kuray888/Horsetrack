import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@cheval/db";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";
import { sendExpoPush } from "@/lib/expoPush";
import {
  MAX_PLANNING_NOTIFICATIONS_PER_HOUR,
  canTrigger,
  notificationKey,
  planningPushMessages,
  planningRecipients,
  whenLabel,
  type PlanningEvent,
} from "@/lib/planningPush";

const schema = z.object({
  kind: z.enum(["session", "slot"]),
  id: z.string().min(1).max(160),
  event: z.enum(["assigned", "done", "cancelled", "slot_assigned"]),
});

/** Un événement rejoué depuis la file hors ligne reste valable un jour. */
const MAX_AGE_MS = 24 * 3_600_000;

const WEEKDAYS = {
  fr: ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"],
  en: ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
};

type HorseTeam = {
  id: string;
  name: string;
  owner: { userId: string };
  collaborators: { collaboratorUserId: string | null; role: string; fullAccess: boolean }[];
};

const horseSelect = {
  id: true,
  name: true,
  owner: { select: { userId: true } },
  collaborators: { where: { status: "ACCEPTED" as const }, select: { collaboratorUserId: true, role: true, fullAccess: true } },
};

function teamOf(horse: HorseTeam) {
  return [
    { userId: horse.owner.userId, role: "OWNER" },
    ...horse.collaborators.filter((c) => c.collaboratorUserId).map((c) => ({ userId: c.collaboratorUserId as string, role: c.fullAccess ? "LEGACY" : c.role })),
  ];
}

/**
 * Notifications du planning (Écurie Pro v2), après une écriture faite par
 * l'app directement dans Supabase : séance attribuée, « a monté », séance
 * annulée, nouveau créneau. Le serveur relit la séance ou le créneau,
 * vérifie que l'appelant peut déclencher l'événement et choisit lui-même
 * destinataires et texte. Une seule notification par événement et par
 * personne (planning_notifications), même si l'app rejoue l'appel.
 */
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  const { kind, id, event } = parsed.data;
  if ((kind === "slot") !== (event === "slot_assigned")) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  let horse: HorseTeam;
  let riderUserId: string | null;
  let createdByUserId: string | null = null;
  let doneByUserId: string | null = null;
  let updatedAt: Date;
  let when: (lang: "fr" | "en") => string;
  let feeling: string | null = null;

  if (kind === "session") {
    const s = await db.trainingSession.findUnique({
      where: { id },
      select: {
        date: true,
        time: true,
        riderUserId: true,
        createdByUserId: true,
        doneByUserId: true,
        completed: true,
        cancelledAt: true,
        feeling: true,
        updatedAt: true,
        horse: { select: horseSelect },
      },
    });
    // Pas encore arrivée (écriture en route) : l'app réessaie.
    if (!s) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    if (event === "done" && !s.completed) return NextResponse.json({ sent: 0 });
    if (event === "cancelled" && !s.cancelledAt) return NextResponse.json({ sent: 0 });
    horse = s.horse;
    riderUserId = s.riderUserId;
    createdByUserId = s.createdByUserId;
    doneByUserId = s.doneByUserId;
    updatedAt = s.updatedAt;
    feeling = s.feeling;
    when = (lang) => whenLabel(s.date, s.time.trim() || null, lang);
  } else {
    const slot = await db.rideSlot.findUnique({
      where: { id },
      select: { weekday: true, startTime: true, riderUserId: true, updatedAt: true, horse: { select: horseSelect } },
    });
    if (!slot) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    horse = slot.horse;
    riderUserId = slot.riderUserId;
    updatedAt = slot.updatedAt;
    when = (lang) => {
      const day = WEEKDAYS[lang][slot.weekday] ?? "";
      const every = lang === "en" ? `every ${day}` : `chaque ${day}`;
      return slot.startTime ? `${every}${lang === "en" ? " at " : " à "}${slot.startTime}` : every;
    };
  }
  if (Date.now() - updatedAt.getTime() > MAX_AGE_MS) return NextResponse.json({ sent: 0 });

  const team = teamOf(horse);
  const callerRole = team.find((m) => m.userId === userId)?.role ?? null;
  if (!canTrigger(event as PlanningEvent, { callerId: userId, callerRole, createdByUserId, doneByUserId })) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const since = new Date(Date.now() - 3_600_000);
  const recent = await db.planningNotification.count({ where: { senderUserId: userId, createdAt: { gte: since } } });
  if (recent >= MAX_PLANNING_NOTIFICATIONS_PER_HOUR) return NextResponse.json({ sent: 0 });

  // Une seule fois par événement et par personne : on réserve la clé avant
  // d'envoyer ; une clé déjà prise (rejeu) écarte ce destinataire.
  const fresh: string[] = [];
  for (const recipient of planningRecipients(event as PlanningEvent, { callerId: userId, riderUserId, team })) {
    try {
      await db.planningNotification.create({ data: { id: notificationKey(kind, id, event as PlanningEvent, recipient), senderUserId: userId } });
      fresh.push(recipient);
    } catch {
      // déjà prévenu
    }
  }
  if (fresh.length === 0) return NextResponse.json({ sent: 0 });

  const caller = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  const who = (caller?.name?.trim() || caller?.email?.split("@")[0] || "").slice(0, 40);
  const recipients = await db.pushToken.findMany({ where: { userId: { in: fresh } }, select: { token: true, userId: true, lang: true } });
  const messages = planningPushMessages(event as PlanningEvent, recipients, "/planning-semaine", (lang) => ({
    who: who || (lang === "en" ? "Someone" : "Quelqu'un"),
    horseName: horse.name.slice(0, 40),
    when: when(lang),
    feeling,
  }));
  let sent = 0;
  try {
    sent = await sendExpoPush(messages);
  } catch {
    sent = 0;
  }
  // Rien n'est parti (envoi en échec, pas encore de jeton) : on libère les
  // clés pour qu'une nouvelle tentative puisse encore prévenir la personne.
  if (sent === 0) {
    await db.planningNotification
      .deleteMany({ where: { id: { in: fresh.map((r) => notificationKey(kind, id, event as PlanningEvent, r)) } } })
      .catch(() => undefined);
  }
  return NextResponse.json({ sent });
}
