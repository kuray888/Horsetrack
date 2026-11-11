/**
 * Prévision horaire renvoyée par notre API (/api/weather, données MET Norway)
 * → météo actuelle et journées, dans le fuseau du téléphone. Logique pure,
 * testée dans weatherForecast.test.ts.
 */
export type WeatherHour = {
  /** ISO UTC. */
  time: string;
  tempC: number;
  /** Code WMO (0 ciel dégagé … 95 orage), cf. lib/weather.ts. */
  code: number;
  precipMm: number | null;
  windKmh: number | null;
};

const MAX_GAP_MS = 3 * 3600_000;

/** L'heure de prévision la plus proche de maintenant, si elle est à moins de 3 h. */
export function currentFromHours(hours: WeatherHour[], now: Date): { tempC: number; code: number } | null {
  let best: WeatherHour | null = null;
  let bestGap = Infinity;
  for (const h of hours) {
    const gap = Math.abs(Date.parse(h.time) - now.getTime());
    if (gap < bestGap) {
      best = h;
      bestGap = gap;
    }
  }
  return best && bestGap <= MAX_GAP_MS ? { tempC: best.tempC, code: best.code } : null;
}

const isStorm = (c: number) => c >= 95;
// Neige, grésil, pluie verglaçante : mêmes codes que le coach (coach/constraints.ts).
const isFreezing = (c: number) => [56, 57, 66, 67, 71, 73, 75, 77, 85, 86].includes(c);
const isRain = (c: number) => ((c >= 51 && c <= 65) || (c >= 80 && c <= 82)) && !isFreezing(c);

/** Ce qu'un cavalier doit retenir de la journée : un orage ou de la neige
 * comptent dès la première heure ; la pluie seulement si elle dure (2 h et
 * plus) ; sinon, le ciel le plus fréquent en journée (7 h – 20 h). */
export function dayCode(hours: WeatherHour[]): number {
  const codes = hours.map((h) => h.code);
  const worst = (pred: (c: number) => boolean) => Math.max(...codes.filter(pred));
  if (codes.some(isStorm)) return worst(isStorm);
  if (codes.some(isFreezing)) return worst(isFreezing);
  if (codes.filter(isRain).length >= 2) return worst(isRain);
  const daytime = hours.filter((h) => {
    const hour = new Date(h.time).getHours();
    return hour >= 7 && hour <= 20;
  });
  const sky = (daytime.length > 0 ? daytime : hours).map((h) => h.code).filter((c) => !isRain(c));
  if (sky.length === 0) return worst(isRain);
  const counts = new Map<number, number>();
  for (const c of sky) counts.set(c, (counts.get(c) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

export type DayForecast = { date: Date; tempMinC: number; tempMaxC: number; code: number };

/** Journées à partir d'aujourd'hui (minuit local), `days` au plus. */
export function dailyFromHours(hours: WeatherHour[], now: Date, days: number): DayForecast[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const byDay = new Map<number, WeatherHour[]>();
  for (const h of hours) {
    const d = new Date(h.time);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (day < today) continue;
    byDay.set(day, [...(byDay.get(day) ?? []), h]);
  }
  return [...byDay.keys()]
    .sort((a, b) => a - b)
    .slice(0, days)
    .map((day) => {
      const list = byDay.get(day) ?? [];
      const temps = list.map((h) => h.tempC);
      return {
        date: new Date(day),
        tempMinC: Math.round(Math.min(...temps)),
        tempMaxC: Math.round(Math.max(...temps)),
        code: dayCode(list),
      };
    });
}
