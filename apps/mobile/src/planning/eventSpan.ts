/**
 * Durée d'un événement de plusieurs jours — un concours international dure
 * souvent 4 ou 5 jours (cf. Appointment.endDate). Module pur et sans
 * dépendance, testable sous Vitest sans passer par react-native.
 */

/** Plafond de jours couverts : une date de fin saisie par erreur (année
 * suivante...) ne doit pas noircir la grille du mois ni geler le rendu. */
export const MAX_EVENT_SPAN_DAYS = 14;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Dernier jour d'un événement : `endDate` s'il est postérieur au début (au
 * jour près), sinon le jour de début lui-même. */
export function lastDayOf(start: Date, endDate: Date | null): Date {
  const first = startOfDay(start);
  if (!endDate) return first;
  const last = startOfDay(endDate);
  return last.getTime() > first.getTime() ? last : first;
}

/** Tous les jours couverts, début et fin inclus (au plus MAX_EVENT_SPAN_DAYS). */
export function daysCovered(start: Date, endDate: Date | null): Date[] {
  const first = startOfDay(start);
  const last = lastDayOf(start, endDate);
  const days: Date[] = [];
  for (let i = 0; i < MAX_EVENT_SPAN_DAYS; i++) {
    const day = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i);
    if (day.getTime() > last.getTime()) break;
    days.push(day);
  }
  return days;
}

/** Fin par défaut d'un concours international dont on vient de saisir le
 * premier jour : trois jours plus tard, soit un événement de 4 jours. */
export function defaultInternationalEnd(start: Date): Date {
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 3);
}
