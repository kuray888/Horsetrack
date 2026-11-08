import type { Appointment, Expense } from "@/agenda/store";
import type { TrainingSession } from "@/sessions/store";

/**
 * Vue écurie (Écurie Pro) — logique pure, testée : un résumé par cheval pour
 * voir d'un coup d'œil ce qui demande de l'attention dans toute l'écurie.
 */

export type StableHorseInput = { id: string; name: string; photoUrl: string | null };

export type StableHorseRow = {
  horseId: string;
  name: string;
  photoUrl: string | null;
  /** Soins dont l'échéance est passée sans avoir été refaits. */
  overdue: Appointment[];
  /** Prochaine échéance de soin à venir. */
  nextDue: Appointment | null;
  weekDone: number;
  weekTotal: number;
  monthExpenses: number;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Semaine du lundi au dimanche qui contient `today`. */
export function weekBounds(today: Date): { start: Date; end: Date } {
  const start = startOfDay(today);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

/**
 * Soins en retard d'un cheval : pour chaque type de soin, seul le rendez-vous
 * le plus récent compte (un vaccin refait depuis n'est plus en retard) ; il est
 * en retard si sa prochaine échéance est passée.
 */
export function overdueCare(appointments: Appointment[], horseId: string, today: Date): Appointment[] {
  const day = startOfDay(today);
  const latestByType = new Map<string, Appointment>();
  for (const a of appointments) {
    if (a.horseId !== horseId) continue;
    const prev = latestByType.get(a.type);
    if (!prev || a.date > prev.date) latestByType.set(a.type, a);
  }
  return [...latestByType.values()]
    .filter((a) => a.nextDueDate && a.nextDueDate < day)
    .sort((a, b) => a.nextDueDate!.getTime() - b.nextDueDate!.getTime());
}

/** Résumé par cheval, ceux qui ont des soins en retard d'abord, puis par
 * prochaine échéance. */
export function buildStableOverview(input: {
  horses: StableHorseInput[];
  appointments: Appointment[];
  sessions: TrainingSession[];
  expenses: Expense[];
  today: Date;
}): StableHorseRow[] {
  const { horses, appointments, sessions, expenses, today } = input;
  const day = startOfDay(today);
  const { start, end } = weekBounds(today);
  const rows = horses.map((h): StableHorseRow => {
    const overdue = overdueCare(appointments, h.id, today);
    const nextDue =
      appointments
        .filter((a) => a.horseId === h.id && a.nextDueDate && a.nextDueDate >= day)
        .sort((a, b) => a.nextDueDate!.getTime() - b.nextDueDate!.getTime())[0] ?? null;
    const week = sessions.filter((s) => s.horseId === h.id && s.date >= start && s.date < end);
    const monthExpenses = expenses
      .filter((e) => e.horseId === h.id && e.date.getFullYear() === today.getFullYear() && e.date.getMonth() === today.getMonth())
      .reduce((sum, e) => sum + e.amount, 0);
    return {
      horseId: h.id,
      name: h.name,
      photoUrl: h.photoUrl,
      overdue,
      nextDue,
      weekDone: week.filter((s) => s.completed).length,
      weekTotal: week.length,
      monthExpenses,
    };
  });
  return rows.sort((a, b) => {
    if (a.overdue.length !== b.overdue.length) return b.overdue.length - a.overdue.length;
    const ad = a.nextDue?.nextDueDate?.getTime() ?? Infinity;
    const bd = b.nextDue?.nextDueDate?.getTime() ?? Infinity;
    return ad - bd;
  });
}
