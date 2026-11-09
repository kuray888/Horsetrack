import { isExpoPushToken, type PushRecipient } from "@/lib/communityPush";
import type { ExpoPushMessage } from "@/lib/expoPush";

/**
 * Notifications du planning (Écurie Pro v2) — logique pure, testée
 * (planningPush.test.ts). Le serveur relit la séance ou le créneau : l'app
 * ne choisit ni les destinataires ni le texte (cf. app/api/planning/notify).
 */

export type PlanningEvent = "assigned" | "done" | "cancelled" | "slot_assigned";

export type TeamEntry = { userId: string; role: string };

/** Rôles qui organisent le planning (cf. rls.sql horse_role_can). */
const PLANNERS = ["OWNER", "MANAGER", "COACH"];

/** Un ancien partage (fullAccess) garde ses droits d'avant : il organise le
 * planning (rls.sql, rôle LEGACY) mais ne reçoit pas de notification de plus. */
const TRIGGERERS = [...PLANNERS, "LEGACY"];

/** Au plus 60 notifications du planning par expéditeur et par heure. */
export const MAX_PLANNING_NOTIFICATIONS_PER_HOUR = 60;

/** L'appelant peut-il déclencher cet événement ? */
export function canTrigger(
  event: PlanningEvent,
  ctx: { callerId: string; callerRole: string | null; createdByUserId: string | null; doneByUserId: string | null }
): boolean {
  if (!ctx.callerRole) return false;
  switch (event) {
    case "done":
      return !!ctx.doneByUserId && ctx.doneByUserId === ctx.callerId;
    case "slot_assigned":
      return TRIGGERERS.includes(ctx.callerRole);
    case "assigned":
    case "cancelled":
      return TRIGGERERS.includes(ctx.callerRole) || ctx.createdByUserId === ctx.callerId;
  }
}

/** Qui prévenir : le cavalier attribué (s'il n'est pas l'appelant) ; pour
 * « a monté », ceux qui organisent le planning du cheval. Sans doublon. */
export function planningRecipients(
  event: PlanningEvent,
  ctx: { callerId: string; riderUserId: string | null; team: TeamEntry[] }
): string[] {
  const ids =
    event === "done"
      ? ctx.team.filter((m) => PLANNERS.includes(m.role)).map((m) => m.userId)
      : ctx.riderUserId
        ? [ctx.riderUserId]
        : [];
  const members = new Set(ctx.team.map((m) => m.userId));
  return [...new Set(ids)].filter((id) => id !== ctx.callerId && members.has(id));
}

/** Clé de déduplication : une notification par événement et par personne. */
export function notificationKey(kind: "session" | "slot", id: string, event: PlanningEvent, recipient: string): string {
  return `${kind}:${id}:${event}:${recipient}`;
}

const FEELING: Record<string, { fr: string; en: string }> = {
  GOOD: { fr: "bonne séance", en: "good session" },
  OK: { fr: "séance correcte", en: "okay session" },
  HARD: { fr: "séance difficile", en: "tough session" },
};

const WEEKDAYS = {
  fr: ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
};

/** « mardi 10/11 à 18:00 » — date au fuseau de Paris (dates stockées à
 * minuit local de l'appareil). */
export function whenLabel(date: Date, time: string | null, lang: "fr" | "en"): string {
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "short", day: "2-digit", month: "2-digit" })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  const weekdayIndex = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."].indexOf(parts.weekday);
  const day = `${WEEKDAYS[lang][weekdayIndex] ?? ""} ${parts.day}/${parts.month}`.trim();
  if (!time) return day;
  return lang === "en" ? `${day} at ${time}` : `${day} à ${time}`;
}

export function planningMessage(
  event: PlanningEvent,
  lang: "fr" | "en",
  d: { who: string; horseName: string; when: string; feeling?: string | null; weekdays?: string }
): { title: string; body: string } {
  const en = lang === "en";
  switch (event) {
    case "assigned":
      return en
        ? { title: `You're riding ${d.horseName}`, body: `${d.who} planned a session for you: ${d.when}.` }
        : { title: `Tu montes ${d.horseName}`, body: `${d.who} t'a prévu une séance : ${d.when}.` };
    case "slot_assigned":
      return en
        ? { title: `New slot with ${d.horseName}`, body: `${d.who} added you to the schedule: ${d.weekdays ?? d.when}.` }
        : { title: `Nouveau créneau avec ${d.horseName}`, body: `${d.who} t'a ajouté·e au planning : ${d.weekdays ?? d.when}.` };
    case "cancelled":
      return en
        ? { title: `Session cancelled`, body: `${d.horseName}, ${d.when}: cancelled by ${d.who}.` }
        : { title: `Séance annulée`, body: `${d.horseName}, ${d.when} : annulée par ${d.who}.` };
    case "done": {
      const feeling = d.feeling ? FEELING[d.feeling]?.[lang] : null;
      return en
        ? { title: `${d.who} rode ${d.horseName}`, body: feeling ? `${d.when} · ${feeling}.` : `${d.when}.` }
        : { title: `${d.who} a monté ${d.horseName}`, body: feeling ? `${d.when} · ${feeling}.` : `${d.when}.` };
    }
  }
}

export function planningPushMessages(
  event: PlanningEvent,
  recipients: PushRecipient[],
  url: string,
  data: (lang: "fr" | "en") => { who: string; horseName: string; when: string; feeling?: string | null; weekdays?: string }
): ExpoPushMessage[] {
  return recipients
    .filter((r) => isExpoPushToken(r.token))
    .map((r) => {
      const lang = r.lang === "en" ? "en" : "fr";
      const { title, body } = planningMessage(event, lang, data(lang));
      return { to: r.token, title, body, sound: "default" as const, data: { url } };
    });
}
