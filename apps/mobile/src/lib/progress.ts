/**
 * Indicateurs de progression (série de semaines actives, bilan du mois) —
 * logique pure, testable sans runtime natif. Volontairement sobres : on
 * célèbre la régularité avec son cheval, sans mécanique de jeu culpabilisante
 * (pas de série « perdue » affichée en rouge).
 */

/** Rendez-vous pour lesquels un oubli a de vraies conséquences. */
export const HEALTH_APPOINTMENT_TYPES: ReadonlySet<string> = new Set([
  "veto",
  "osteo",
  "marechal",
  "dentiste",
  "vaccination",
  "vermifuge",
  "traitement",
]);

type SessionLike = { horseId: string | null; date: Date; completed: boolean; durationMinutes: number | null };
type AppointmentLike = { horseId: string | null; date: Date; type: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Lundi 00:00 de la semaine de `d` (convention de l'app : semaine du lundi). */
export function weekStart(d: Date): Date {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

/**
 * Nombre de semaines consécutives avec au moins une séance faite pour ce
 * cheval, en remontant depuis la semaine en cours. La semaine en cours ne
 * casse pas la série tant qu'elle n'a pas de séance : elle n'est pas finie.
 */
export function weeklyStreak(sessions: SessionLike[], horseId: string, now: Date = new Date()): number {
  const activeWeeks = new Set<number>();
  for (const s of sessions) {
    if (s.horseId === horseId && s.completed && s.date.getTime() <= now.getTime()) {
      activeWeeks.add(weekStart(s.date).getTime());
    }
  }
  let cursor = weekStart(now);
  if (!activeWeeks.has(cursor.getTime())) cursor = new Date(cursor.getTime() - 7 * DAY_MS);
  let streak = 0;
  // Pas de `- 7 * DAY_MS` brut au-delà d'une semaine : les changements
  // d'heure décaleraient les clés. On recalcule le lundi à chaque pas.
  while (activeWeeks.has(cursor.getTime())) {
    streak++;
    cursor = weekStart(new Date(cursor.getTime() - 3 * DAY_MS));
  }
  return streak;
}

export type MonthlyRecap = {
  /** 0 = janvier. */
  month: number;
  year: number;
  sessionsDone: number;
  totalMinutes: number;
  competitions: number;
  healthCare: number;
};

/** Bilan du mois PRÉCÉDENT celui de `now`, pour ce cheval. */
export function previousMonthRecap(
  sessions: SessionLike[],
  appointments: AppointmentLike[],
  horseId: string,
  now: Date = new Date()
): MonthlyRecap {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  const inMonth = (d: Date) => d.getTime() >= start.getTime() && d.getTime() < end.getTime();

  const done = sessions.filter((s) => s.horseId === horseId && s.completed && inMonth(s.date));
  const appts = appointments.filter((a) => a.horseId === horseId && inMonth(a.date));
  return {
    month: start.getMonth(),
    year: start.getFullYear(),
    sessionsDone: done.length,
    totalMinutes: done.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0),
    competitions: appts.filter((a) => a.type === "concours").length,
    healthCare: appts.filter((a) => HEALTH_APPOINTMENT_TYPES.has(a.type)).length,
  };
}

/** Le bilan vaut-il d'être montré ? Premiers jours du mois seulement, et
 * seulement s'il y a quelque chose à raconter. */
export function shouldShowMonthlyRecap(recap: MonthlyRecap, now: Date = new Date()): boolean {
  return now.getDate() <= 7 && recap.sessionsDone + recap.competitions + recap.healthCare > 0;
}

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export function monthName(month: number): string {
  return MONTH_NAMES[month] ?? "";
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}

/** Lignes du bilan, sans les compteurs à zéro. */
export function recapLines(recap: MonthlyRecap): string[] {
  const lines: string[] = [];
  if (recap.sessionsDone > 0) {
    const hours = Math.floor(recap.totalMinutes / 60);
    const mins = recap.totalMinutes % 60;
    const duration =
      recap.totalMinutes > 0 ? ` (${hours > 0 ? `${hours} h${mins > 0 ? ` ${mins}` : ""}` : `${mins} min`})` : "";
    lines.push(`${plural(recap.sessionsDone, "séance", "séances")}${duration}`);
  }
  if (recap.competitions > 0) lines.push(plural(recap.competitions, "concours", "concours"));
  if (recap.healthCare > 0) lines.push(plural(recap.healthCare, "soin suivi", "soins suivis"));
  return lines;
}

/** Texte à partager (messagerie, réseaux). */
export function recapShareText(recap: MonthlyRecap, horseName: string, downloadUrl: string | null): string {
  const lines = recapLines(recap).map((l) => `• ${l}`);
  return [
    `${monthName(recap.month)} avec ${horseName} 🐴`,
    ...lines,
    "",
    downloadUrl ? `Suivi avec Horsetrack : ${downloadUrl}` : "Suivi avec Horsetrack",
  ].join("\n");
}
