import { t } from "@/i18n";

/**
 * Rappels de séance — logique pure, testable sans runtime natif (la
 * programmation vit dans sessions/SessionReminders.tsx).
 *
 * Les séances n'avaient aucun rappel : seuls les rendez-vous en portaient.
 * Une séance prévue s'oubliait donc, et la cocher après coup aussi. Ici, un
 * rappel par séance à venir, avec deux boutons (« C'est fait », « Reporter à
 * demain ») : le geste quotidien de l'app devient possible depuis la
 * notification.
 *
 * Rien n'est stocké côté serveur : ce sont des notifications locales, propres
 * à l'appareil, recalculées à partir des séances.
 */

export type SessionLike = {
  id: string;
  horseId: string | null;
  date: Date;
  time: string;
  completed: boolean;
  durationMinutes: number | null;
  customActivityLabel: string | null;
};

export type PlannedReminder = {
  sessionId: string;
  trigger: Date;
  title: string;
  body: string;
  /** Empreinte du contenu : un rappel déjà programmé n'est remplacé que si
   * elle change (heure, cheval, type…). */
  key: string;
};

export type StoredReminder = { notificationId: string; key: string };

/** Fenêtre et plafond : iOS ne garde que 64 notifications en attente, et les
 * rendez-vous en ont besoin aussi (cf. lib/notificationBudget.ts). */
export const SESSION_REMINDER_WINDOW_DAYS = 7;
export const SESSION_REMINDER_MAX = 10;
/** Une heure avant une séance à heure fixe. */
const LEAD_MS = 60 * 60 * 1000;
/** Une séance sans heure (« Heure libre ») se rappelle le matin même. */
const NO_TIME_HOUR = 9;

export const SESSION_REMINDER_CATEGORY = "session_reminder";
export const SESSION_ACTION_DONE = "session_done";
export const SESSION_ACTION_TOMORROW = "session_tomorrow";

/** Heure saisie librement (« 18h », « 18h30 ») ; null si absente ou illisible. */
export function parseSessionTime(time: string): { hour: number; minute: number } | null {
  const match = time.trim().match(/^(\d{1,2})\s*h\s*(\d{1,2})?$/i);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** Moment du rappel, ou null s'il est déjà passé. */
export function sessionReminderTrigger(session: Pick<SessionLike, "date" | "time">, now: Date): Date | null {
  const parsed = parseSessionTime(session.time);
  const trigger = new Date(session.date.getFullYear(), session.date.getMonth(), session.date.getDate());
  if (parsed) {
    trigger.setHours(parsed.hour, parsed.minute, 0, 0);
    trigger.setTime(trigger.getTime() - LEAD_MS);
  } else {
    trigger.setHours(NO_TIME_HOUR, 0, 0, 0);
  }
  return trigger.getTime() > now.getTime() ? trigger : null;
}

/**
 * Rappels voulus : séances non faites, dans les 7 prochains jours, les plus
 * proches d'abord, 10 au plus.
 */
export function planSessionReminders<T extends SessionLike>(
  sessions: T[],
  labelOf: (session: T) => string,
  horseNameOf: (horseId: string | null) => string | null,
  now: Date
): PlannedReminder[] {
  const horizon = now.getTime() + SESSION_REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const planned: PlannedReminder[] = [];
  for (const session of sessions) {
    if (session.completed) continue;
    const trigger = sessionReminderTrigger(session, now);
    if (!trigger || trigger.getTime() > horizon) continue;
    const label = labelOf(session);
    const horseName = horseNameOf(session.horseId);
    const parsed = parseSessionTime(session.time);
    const when = parsed ? t("à {v}", { v: session.time.trim() }) : "aujourd'hui";
    const duration = session.durationMinutes ? t(" · {durationMinutes} min", { durationMinutes: session.durationMinutes }) : "";
    const title = horseName ? t("{label} avec {horseName}", { label: label, horseName: horseName }) : label;
    const body = t("Séance prévue {when}{duration}.", { when: when, duration: duration });
    planned.push({
      sessionId: session.id,
      trigger,
      title,
      body,
      key: `${trigger.toISOString()}|${title}|${body}`,
    });
  }
  planned.sort((a, b) => a.trigger.getTime() - b.trigger.getTime());
  return planned.slice(0, SESSION_REMINDER_MAX);
}

/** Ce qu'il faut annuler et programmer pour passer de l'existant au voulu. */
export function diffSessionReminders(
  stored: Record<string, StoredReminder>,
  desired: PlannedReminder[]
): { toCancel: string[]; toSchedule: PlannedReminder[]; kept: Record<string, StoredReminder> } {
  const desiredById = new Map(desired.map((r) => [r.sessionId, r]));
  const toCancel: string[] = [];
  const kept: Record<string, StoredReminder> = {};
  for (const [sessionId, existing] of Object.entries(stored)) {
    const want = desiredById.get(sessionId);
    if (want && want.key === existing.key) kept[sessionId] = existing;
    else toCancel.push(existing.notificationId);
  }
  const toSchedule = desired.filter((r) => !kept[r.sessionId]);
  return { toCancel, toSchedule, kept };
}

/** « Reporter à demain » : même heure, le lendemain du jour où l'on reporte
 * (pas le lendemain de la date d'origine, si la séance était déjà passée). */
export function postponedDate(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}
