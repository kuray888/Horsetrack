/**
 * Récurrence partagée séances/rendez-vous (cf. audit Phase 8, tranche E) —
 * chaque occurrence générée reste une entité indépendante (TrainingSession ou
 * Appointment normal), éditable/supprimable une par une : pas de notion de
 * "série" liée côté modèle ni en DB, uniquement une liste de dates calculée
 * ici puis consommée par l'appelant pour créer une entité par date.
 */

export type RecurrenceIntervalWeeks = 1 | 2 | 3 | 4;

export type RecurrenceEnd = { type: "count"; occurrences: number } | { type: "date"; date: Date };

export type Recurrence =
  | { mode: "never" }
  | { mode: "custom"; intervalWeeks: RecurrenceIntervalWeeks; end: RecurrenceEnd };

export const NEVER_RECURRENCE: Recurrence = { mode: "never" };

export function defaultCustomRecurrence(): Recurrence {
  return { mode: "custom", intervalWeeks: 1, end: { type: "count", occurrences: 4 } };
}

/** Filet de sécurité si "à une date" pointe loin dans le futur — évite une
 * création en masse accidentelle. Sans rapport avec la borne 2-12 de l'UI
 * pour "après N occurrences", qui est appliquée par RecurrenceField. */
const MAX_OCCURRENCES = 52;

/** Dates de chaque occurrence, la première étant toujours `startDate`. */
export function computeRecurrenceDates(startDate: Date, recurrence: Recurrence): Date[] {
  if (recurrence.mode === "never") return [startDate];
  const { intervalWeeks, end } = recurrence;
  const dates: Date[] = [startDate];
  if (end.type === "count") {
    const total = Math.max(1, Math.min(MAX_OCCURRENCES, end.occurrences));
    for (let i = 1; i < total; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i * intervalWeeks * 7);
      dates.push(d);
    }
    return dates;
  }
  for (let i = 1; i < MAX_OCCURRENCES; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i * intervalWeeks * 7);
    if (d > end.date) break;
    dates.push(d);
  }
  return dates;
}
