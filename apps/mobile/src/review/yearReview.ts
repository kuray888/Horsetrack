import { bestWeeklyStreak } from "@/horses/milestones";
import { isRestActivity, type ActivityType } from "@/agenda/activityKinds";

/**
 * « Ton année avec {cheval} » : le bilan d'une année, à revoir et à partager
 * (cf. app/horse/[id]/annee.tsx). Uniquement des faits enregistrés — séances
 * cochées, concours, soins, souvenirs —, jamais de chiffre inventé ou extrapolé.
 * Logique pure, testée (yearReview.test.ts).
 */

type SessionLike = {
  horseId: string | null;
  date: Date;
  completed: boolean;
  durationMinutes: number | null;
  activityType: ActivityType;
  ride?: { distanceMeters: number; gps: boolean } | null;
};
type AppointmentLike = { horseId: string | null; date: Date; type: string; result: string | null };
type JournalLike = { horseId: string | null; date: Date; photoUri: string | null };

export type YearReview = {
  year: number;
  sessions: number;
  hours: number;
  /** Distance totale des séances enregistrées avec le GPS, en km (arrondie). */
  km: number;
  favoriteActivity: ActivityType | null;
  /** Mois (0-11) le plus chargé, null sans séance. */
  busiestMonth: number | null;
  bestStreakWeeks: number;
  shows: number;
  showResults: string[];
  care: number;
  memories: number;
  photos: number;
};

const CARE_TYPES = new Set(["veto", "osteo", "marechal", "dentiste", "vaccination", "vermifuge", "traitement"]);

export function computeYearReview(
  input: { horseId: string; sessions: SessionLike[]; appointments: AppointmentLike[]; journal: JournalLike[] },
  year: number,
  now: Date = new Date()
): YearReview {
  const inYear = (d: Date) => d.getFullYear() === year && d <= now;
  const done = input.sessions.filter(
    (s) => s.horseId === input.horseId && s.completed && inYear(s.date) && !isRestActivity(s.activityType)
  );

  const byActivity = new Map<ActivityType, number>();
  const byMonth = new Array<number>(12).fill(0);
  let minutes = 0;
  let meters = 0;
  for (const s of done) {
    byActivity.set(s.activityType, (byActivity.get(s.activityType) ?? 0) + 1);
    byMonth[s.date.getMonth()] += 1;
    minutes += s.durationMinutes ?? 0;
    if (s.ride?.gps) meters += s.ride.distanceMeters;
  }
  const favoriteActivity = [...byActivity.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const maxMonth = Math.max(...byMonth);
  const busiestMonth = maxMonth > 0 ? byMonth.indexOf(maxMonth) : null;

  const appts = input.appointments.filter((a) => a.horseId === input.horseId && inYear(a.date));
  const shows = appts.filter((a) => a.type === "concours");
  const journal = input.journal.filter((j) => j.horseId === input.horseId && inYear(j.date));

  const yearEnd = new Date(year, 11, 31, 23, 59, 59);
  const streakSessions = input.sessions.filter((s) => s.date.getFullYear() === year);

  return {
    year,
    sessions: done.length,
    hours: Math.round(minutes / 60),
    km: Math.round(meters / 1000),
    favoriteActivity,
    busiestMonth,
    bestStreakWeeks: bestWeeklyStreak(streakSessions, input.horseId, yearEnd < now ? yearEnd : now),
    shows: shows.length,
    showResults: shows
      .map((a) => a.result?.trim())
      .filter((r): r is string => !!r)
      .slice(0, 3),
    care: appts.filter((a) => CARE_TYPES.has(a.type)).length,
    memories: journal.length,
    photos: journal.filter((j) => !!j.photoUri).length,
  };
}

/** Assez de matière pour un bilan qui ait du sens. */
export function hasYearReview(review: YearReview): boolean {
  return review.sessions + review.shows + review.memories >= 3;
}

/** Période où le bilan de l'année est mis en avant sur l'Accueil : du 1er
 * décembre au 15 janvier (bilan de l'année qui se termine). */
export function featuredReviewYear(now: Date): number | null {
  const m = now.getMonth();
  if (m === 11) return now.getFullYear();
  if (m === 0 && now.getDate() <= 15) return now.getFullYear() - 1;
  return null;
}
