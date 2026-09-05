import type { Appointment } from "@/agenda/store";
import type { TrainingSession } from "@/sessions/store";

/** Prochaine séance planifiée (non faite) d'un cheval — utilisé par Chevaux
 * et le Horse Hub (cf. plan Phase 3), même logique que le filtre "À venir"
 * de today.tsx étendu à une date future quelconque. */
export function findNextSession(sessions: TrainingSession[], horseId: string, today: Date): TrainingSession | null {
  return (
    sessions
      .filter((s) => s.horseId === horseId && s.date >= today && !s.completed)
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null
  );
}

/** Prochaine échéance de soin (ex: prochain vaccin) d'un cheval — même
 * logique que agenda.tsx (upcomingDueDates), restreinte à un cheval donné. */
export function findNextDue(appointments: Appointment[], horseId: string, today: Date): Appointment | null {
  return (
    appointments
      .filter((a) => a.horseId === horseId && a.nextDueDate && a.nextDueDate >= today)
      .sort((a, b) => a.nextDueDate!.getTime() - b.nextDueDate!.getTime())[0] ?? null
  );
}

/** Prochain concours d'un cheval (type "concours", date future) — distinct de
 * findNextDue (qui porte sur nextDueDate, une échéance de soin, pas la date
 * du rendez-vous lui-même). */
export function findNextCompetition(appointments: Appointment[], horseId: string, today: Date): Appointment | null {
  return (
    appointments
      .filter((a) => a.horseId === horseId && a.type === "concours" && a.date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null
  );
}
