import type { ActivityType } from "@/agenda/store";
import type { TrainingSession } from "@/sessions/store";

/**
 * Statistiques d'entraînement — pure fonction sur les séances déjà chargées
 * (aucune requête, aucun état), pas d'IA : de simples agrégats sur les
 * séances cochées "faites" (cf. TrainingSession.completed), dans une période
 * donnée. "repos" est un ActivityType comme un autre (cf. ACTIVITY_META) —
 * une séance de repos cochée faite compte comme jour de repos, pas comme
 * séance d'entraînement.
 */

export type DisciplineCount = { activityType: ActivityType; count: number };

export type SessionStats = {
  /** Séances d'entraînement faites (hors "repos"), dans la période. */
  sessionCount: number;
  totalMinutes: number;
  /** Arrondie à la minute — 0 si aucune séance n'a de durée renseignée. */
  avgMinutes: number;
  /** Séances d'entraînement par semaine, en moyenne sur la période. */
  perWeek: number;
  /** Répartition par discipline (hors "repos"), triée par nombre décroissant. */
  perDiscipline: DisciplineCount[];
  /** Séances explicitement loguées en "repos" et cochées faites. */
  restDays: number;
};

export function computeSessionStats(sessions: TrainingSession[], from: Date, to: Date): SessionStats {
  const inRange = sessions.filter((s) => s.completed && s.date >= from && s.date <= to);
  const training = inRange.filter((s) => s.activityType !== "repos");
  const restDays = inRange.length - training.length;

  const sessionCount = training.length;
  const totalMinutes = training.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
  const avgMinutes = sessionCount > 0 ? Math.round(totalMinutes / sessionCount) : 0;

  const periodDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1);
  const perWeek = Math.round((sessionCount / periodDays) * 7 * 10) / 10;

  const counts = new Map<ActivityType, number>();
  for (const s of training) counts.set(s.activityType, (counts.get(s.activityType) ?? 0) + 1);
  const perDiscipline = Array.from(counts.entries())
    .map(([activityType, count]) => ({ activityType, count }))
    .sort((a, b) => b.count - a.count);

  return { sessionCount, totalMinutes, avgMinutes, perWeek, perDiscipline, restDays };
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
