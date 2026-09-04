import { HEALTH_APPT_TYPES } from "@/agenda/meta";
import type { Appointment } from "@/agenda/store";
import type { TrainingSession } from "@/sessions/store";

/**
 * Un "planning unifié" est d'abord une unification d'affichage (cf. plan
 * Phase 3 Étape 3) : aucune nouvelle table, aucune fusion de données côté
 * store — TrainingSession et Appointment restent deux collections séparées.
 * UnifiedEvent est juste une enveloppe légère avec les champs communs
 * nécessaires pour trier/regrouper/filtrer une liste mêlant les deux, en
 * gardant une référence à l'objet d'origine complet pour l'affichage détaillé
 * (cf. UnifiedEventCard, qui délègue à SessionCard/AppointmentCard selon `kind`).
 */
export type PlanningFilterValue = "all" | "session" | "soin" | "concours" | "autre";

/** Valeurs valides de PlanningFilterValue — utilisé par PlanningScreen pour
 * valider un `?filter=` de route (cf. app/horse/[id]/entrainement.tsx et
 * concours.tsx) avant de s'en servir comme état initial. */
export const PLANNING_FILTER_VALUES: PlanningFilterValue[] = ["all", "session", "soin", "concours", "autre"];

export type UnifiedEvent =
  | { kind: "session"; id: string; date: Date; session: TrainingSession }
  | { kind: "appointment"; id: string; date: Date; appointment: Appointment; category: "soin" | "concours" | "autre" };

function appointmentCategory(appt: Appointment): "soin" | "concours" | "autre" {
  if (appt.type === "concours") return "concours";
  if ((HEALTH_APPT_TYPES as readonly string[]).includes(appt.type)) return "soin";
  return "autre";
}

/** Fusionne séances + rendez-vous d'un cheval en une seule liste triable par
 * date — pas de filtrage ici (cf. filterUnifiedEvents), pas de tri non plus
 * (l'appelant trie selon son besoin : "À venir" croissant, "Passées" décroissant). */
export function buildUnifiedEvents(sessions: TrainingSession[], appointments: Appointment[]): UnifiedEvent[] {
  return [
    ...sessions.map((session): UnifiedEvent => ({ kind: "session", id: `session-${session.id}`, date: session.date, session })),
    ...appointments.map(
      (appointment): UnifiedEvent => ({
        kind: "appointment",
        id: `appt-${appointment.id}`,
        date: appointment.date,
        appointment,
        category: appointmentCategory(appointment),
      })
    ),
  ];
}

export function filterUnifiedEvents(events: UnifiedEvent[], filter: PlanningFilterValue): UnifiedEvent[] {
  if (filter === "all") return events;
  if (filter === "session") return events.filter((e) => e.kind === "session");
  return events.filter((e) => e.kind === "appointment" && e.category === filter);
}

/** Heure d'un événement unifié, quel que soit son type — pour trier une
 * liste d'un même jour (cf. Planning, vue mois). */
export function eventTime(event: UnifiedEvent): string {
  return event.kind === "session" ? event.session.time : event.appointment.time;
}

/** "À venir" : une séance non cochée faite et future, OU un rendez-vous
 * futur — les rendez-vous n'ont pas de case "faite" (cf. Appointment), seule
 * la date les fait basculer côté "Passées", même logique que l'ancien
 * Agenda (upcomingAppts/pastAppts). */
export function isEventUpcoming(event: UnifiedEvent, todayStart: Date): boolean {
  if (event.kind === "session") return !event.session.completed && event.date >= todayStart;
  return event.date >= todayStart;
}

/** Événements à venir triés chronologiquement (croissant) — utilisé par
 * Accueil (3 prochains événements, cf. plan Phase 3 Étape 4 §8) et par
 * Planning (liste "À venir", regroupée par jour en plus, cf. planning.tsx). */
export function upcomingUnifiedEvents(events: UnifiedEvent[], todayStart: Date): UnifiedEvent[] {
  return events.filter((e) => isEventUpcoming(e, todayStart)).sort((a, b) => a.date.getTime() - b.date.getTime());
}
