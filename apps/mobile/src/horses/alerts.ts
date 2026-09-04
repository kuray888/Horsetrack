import { APPT_META, daysUntilLabel } from "@/agenda/meta";
import { findNextDue, findNextCompetition } from "@/agenda/upcoming";
import type { Appointment } from "@/agenda/store";
import type { Horse } from "@/horses/store";

export type HorseAlert = {
  horseId: string;
  horseName: string;
  kind: "health" | "concours";
  message: string;
};

/** Fenêtres du brief Accueil (cf. plan Phase 3 Étape 4 §6) : échéance santé
 * dans les 14 prochains jours, concours dans les 7 prochains jours. */
const HEALTH_WINDOW_DAYS = 14;
const CONCOURS_WINDOW_DAYS = 7;

function daysUntil(today: Date, target: Date): number {
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

/** Une alerte au maximum par cheval (la plus urgente des deux si les deux
 * s'appliquent) — pour éviter d'empiler plusieurs bannières anxiogènes pour
 * un même cheval (cf. brief "évite les alertes inutiles ou anxiogènes").
 * Pure fonction sur les données déjà chargées, réutilise findNextDue/
 * findNextCompetition (déjà utilisés par Chevaux et le Horse Hub) — aucune
 * nouvelle logique de calcul d'échéance. */
export function buildHorseAlerts(horses: Horse[], appointments: Appointment[], today: Date): HorseAlert[] {
  const alerts: HorseAlert[] = [];

  for (const horse of horses) {
    const candidates: { kind: "health" | "concours"; daysUntil: number; message: string }[] = [];

    const nextDue = findNextDue(appointments, horse.id, today);
    if (nextDue) {
      const d = daysUntil(today, nextDue.nextDueDate!);
      if (d <= HEALTH_WINDOW_DAYS) {
        candidates.push({ kind: "health", daysUntil: d, message: `${APPT_META[nextDue.type].label} ${daysUntilLabel(nextDue.nextDueDate!)}` });
      }
    }

    const nextCompetition = findNextCompetition(appointments, horse.id, today);
    if (nextCompetition) {
      const d = daysUntil(today, nextCompetition.date);
      if (d <= CONCOURS_WINDOW_DAYS) {
        candidates.push({ kind: "concours", daysUntil: d, message: `Concours ${daysUntilLabel(nextCompetition.date)}` });
      }
    }

    if (candidates.length === 0) continue;
    candidates.sort((a, b) => a.daysUntil - b.daysUntil);
    const top = candidates[0];
    alerts.push({ horseId: horse.id, horseName: horse.name, kind: top.kind, message: top.message });
  }

  return alerts;
}
