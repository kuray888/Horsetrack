import { APPT_META, daysUntilLabel } from "@/agenda/meta";
import { findNextDue, findNextCompetition } from "@/agenda/upcoming";
import type { Appointment } from "@/agenda/store";
import { recoveryAlertMessage } from "@/horses/injuries";
import type { Horse } from "@/horses/store";

export type HorseAlert = {
  horseId: string;
  horseName: string;
  kind: "health" | "concours" | "injury";
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
    const candidates: { kind: HorseAlert["kind"]; daysUntil: number; message: string }[] = [];

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

    // Blessure en cours de récupération (cf. injuries.ts) : pas d'échéance
    // datée, donc classée APRÈS toute alerte datée — une seule bannière par
    // cheval, on ne la fait passer devant un vaccin ou un concours imminent.
    const injuryMessage = recoveryAlertMessage(horse.injuries);
    if (injuryMessage) candidates.push({ kind: "injury", daysUntil: Number.POSITIVE_INFINITY, message: injuryMessage });

    if (candidates.length === 0) continue;
    // Comparaison explicite plutôt que `a - b` : Infinity - Infinity vaut NaN.
    candidates.sort((a, b) => (a.daysUntil < b.daysUntil ? -1 : a.daysUntil > b.daysUntil ? 1 : 0));
    const top = candidates[0];
    alerts.push({ horseId: horse.id, horseName: horse.name, kind: top.kind, message: top.message });
  }

  return alerts;
}
