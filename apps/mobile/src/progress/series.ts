/**
 * Progression du cheval (cf. docs/progression-cheval.md, jalon J1) : séries
 * calculées à partir des données déjà sur le téléphone, sans nouvelle saisie.
 * Logique pure, testée dans series.test.ts.
 */

export type SessionLike = {
  horseId: string | null;
  date: Date;
  durationMinutes: number | null;
  intensity: "low" | "medium" | "high" | null;
  completed: boolean;
};

export type WeekPoint = {
  /** Lundi de la semaine, minuit local. */
  weekStart: Date;
  minutes: number;
  /** Minutes pondérées par l'intensité : légère 1, modérée 1,5, intense 2. */
  load: number;
  sessions: number;
};

const INTENSITY_FACTOR = { low: 1, medium: 1.5, high: 2 } as const;
const DAY_MS = 86_400_000;

function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** `weeks` semaines terminées par la semaine en cours, de la plus ancienne à
 * la plus récente ; semaines sans séance comprises (à 0). Seules les séances
 * faites, de ce cheval, déjà passées comptent. */
export function weeklySeries(sessions: SessionLike[], horseId: string, now: Date, weeks: number): WeekPoint[] {
  const current = mondayOf(now);
  const points: WeekPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(current);
    start.setDate(start.getDate() - 7 * i);
    points.push({ weekStart: start, minutes: 0, load: 0, sessions: 0 });
  }
  const first = points[0]?.weekStart.getTime() ?? Infinity;
  for (const s of sessions) {
    if (!s.completed || s.horseId !== horseId || s.date.getTime() > now.getTime() || s.date.getTime() < first) continue;
    // Arrondi : un changement d'heure ne décale pas la semaine.
    const index = Math.round((mondayOf(s.date).getTime() - first) / (7 * DAY_MS));
    const point = points[index];
    if (!point) continue;
    const minutes = s.durationMinutes ?? 0;
    point.sessions += 1;
    point.minutes += minutes;
    point.load += minutes * (s.intensity ? INTENSITY_FACTOR[s.intensity] : 1);
  }
  return points;
}

/** Semaines avec au moins une séance, et série de semaines actives qui se
 * termine maintenant (la semaine en cours, pas encore finie, ne la casse pas). */
export function regularity(points: WeekPoint[]): { activeWeeks: number; totalWeeks: number; currentStreak: number } {
  const activeWeeks = points.filter((p) => p.sessions > 0).length;
  let streak = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].sessions > 0) streak += 1;
    else if (i === points.length - 1) continue;
    else break;
  }
  return { activeWeeks, totalWeeks: points.length, currentStreak: streak };
}

/** Minutes des `size` dernières semaines comparées aux `size` d'avant.
 * `deltaPct` null quand la période précédente est vide (pas de « +∞ % »). */
export function comparePeriods(points: WeekPoint[], size: number): { current: number; previous: number; deltaPct: number | null } {
  const sum = (list: WeekPoint[]) => list.reduce((a, p) => a + p.minutes, 0);
  const current = sum(points.slice(-size));
  const previous = sum(points.slice(-2 * size, -size));
  return { current, previous, deltaPct: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null };
}

/** Écart entre la première et la dernière pesée des `months` derniers mois. */
export function weightTrend(
  measurements: { date: Date; weightKg: number }[],
  now: Date,
  months: number
): { firstKg: number; lastKg: number; deltaKg: number; count: number } | null {
  const from = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  const inRange = measurements
    .filter((m) => m.date.getTime() >= from.getTime() && m.date.getTime() <= now.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (inRange.length < 2) return null;
  const firstKg = inRange[0].weightKg;
  const lastKg = inRange[inRange.length - 1].weightKg;
  return { firstKg, lastKg, deltaKg: lastKg - firstKg, count: inRange.length };
}
