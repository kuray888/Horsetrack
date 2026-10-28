import { weekStart } from "@/lib/progress";
import { t as tr } from "@/i18n";

/**
 * Badges du couple cavalier-cheval — logique pure, testable.
 *
 * Volontairement PAS de points ni de niveau gagnés en utilisant l'app : on
 * récompenserait la saisie plutôt que l'équitation, et une série à tenir
 * pousserait à monter un cheval qui a besoin de repos. Les badges célèbrent
 * des faits réels (heures de travail, régularité, concours, soins), et
 * aucun ne se perd : la meilleure série compte, pas la série en cours.
 */

type SessionLike = { horseId: string | null; date: Date; completed: boolean; durationMinutes: number | null };
type AppointmentLike = { horseId: string | null; date: Date; type: string };
type JournalLike = { horseId: string | null };

export type MilestoneInput = {
  horseId: string;
  sessions: SessionLike[];
  appointments?: AppointmentLike[];
  journal?: JournalLike[];
  now?: Date;
};

export type Milestone = {
  id: string;
  title: string;
  emoji: string;
  unlocked: boolean;
  /** Avancement vers le seuil, pour afficher le prochain badge. */
  current: number;
  target: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Plus longue suite de semaines consécutives avec au moins une séance faite. */
export function bestWeeklyStreak(sessions: SessionLike[], horseId: string, now: Date = new Date()): number {
  const weeks = new Set<number>();
  for (const s of sessions) {
    if (s.horseId === horseId && s.completed && s.date.getTime() <= now.getTime()) weeks.add(weekStart(s.date).getTime());
  }
  let best = 0;
  for (const w of weeks) {
    // Début d'une suite seulement : la semaine d'avant n'en fait pas partie.
    const previous = weekStart(new Date(w - 3 * DAY_MS)).getTime();
    if (weeks.has(previous)) continue;
    let length = 0;
    let cursor = w;
    while (weeks.has(cursor)) {
      length++;
      cursor = weekStart(new Date(cursor + 10 * DAY_MS)).getTime();
    }
    best = Math.max(best, length);
  }
  return best;
}

const HEALTH_TYPES = new Set(["veto", "osteo", "marechal", "dentiste", "vaccination", "vermifuge", "traitement"]);

export function computeMilestones({ horseId, sessions, appointments = [], journal = [], now = new Date() }: MilestoneInput): Milestone[] {
  const done = sessions.filter((s) => s.horseId === horseId && s.completed && s.date.getTime() <= now.getTime());
  const hours = Math.floor(done.reduce((n, s) => n + (s.durationMinutes ?? 0), 0) / 60);
  const streak = bestWeeklyStreak(sessions, horseId, now);
  const pastAppointments = appointments.filter((a) => a.horseId === horseId && a.date.getTime() <= now.getTime());
  const competitions = pastAppointments.filter((a) => a.type === "concours").length;
  const careVisits = pastAppointments.filter((a) => HEALTH_TYPES.has(a.type)).length;
  const memories = journal.filter((j) => j.horseId === horseId).length;
  const firstDate = [...done.map((s) => s.date.getTime()), ...pastAppointments.map((a) => a.date.getTime())].reduce(
    (min, t) => Math.min(min, t),
    Infinity
  );
  const daysTogether = Number.isFinite(firstDate) ? Math.floor((now.getTime() - firstDate) / DAY_MS) : 0;

  const m = (id: string, title: string, emoji: string, current: number, target: number): Milestone => ({
    id,
    title,
    emoji,
    current: Math.min(current, target),
    target,
    unlocked: current >= target,
  });

  return [
    m("sessions-1", tr("Première séance"), "🐴", done.length, 1),
    m("sessions-10", tr("10 séances"), "⭐", done.length, 10),
    m("sessions-50", tr("50 séances"), "🌟", done.length, 50),
    m("sessions-100", tr("100 séances"), "🏆", done.length, 100),
    m("hours-10", tr("10 heures de travail"), "⏱️", hours, 10),
    m("hours-50", tr("50 heures de travail"), "💪", hours, 50),
    m("hours-100", tr("100 heures de travail"), "🥇", hours, 100),
    m("streak-4", tr("4 semaines d'affilée"), "🔥", streak, 4),
    m("streak-12", tr("12 semaines d'affilée"), "🔥", streak, 12),
    m("competition-1", tr("Premier concours"), "🎖️", competitions, 1),
    m("competition-10", tr("10 concours"), "🏅", competitions, 10),
    m("care-5", tr("5 soins suivis"), "🩺", careVisits, 5),
    m("journal-10", tr("10 souvenirs"), "📖", memories, 10),
    m("together-365", tr("1 an de suivi ensemble"), "🎂", daysTogether, 365),
  ];
}

/** Badges débloqués par un changement (ex. une séance cochée). */
export function newlyUnlocked(before: Milestone[], after: Milestone[]): Milestone[] {
  const was = new Set(before.filter((x) => x.unlocked).map((x) => x.id));
  return after.filter((x) => x.unlocked && !was.has(x.id));
}

/** Prochain badge à portée : le moins éloigné en proportion. */
export function nextMilestone(milestones: Milestone[]): Milestone | null {
  const locked = milestones.filter((x) => !x.unlocked);
  if (locked.length === 0) return null;
  return locked.reduce((best, x) => (x.current / x.target > best.current / best.target ? x : best));
}
