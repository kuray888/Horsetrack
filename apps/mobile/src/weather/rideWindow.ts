import type { WeatherHour } from "@/lib/weatherForecast";

/**
 * Lecture « cavalier » de la prévision horaire (cf. docs/meteo-repensee.md) :
 * le meilleur créneau pour monter aujourd'hui, et ce qui demande de
 * l'attention dans les prochaines 24 h. Logique pure, testée dans
 * rideWindow.test.ts.
 */

/** Seuils d'une heure « montable » : au sec, vent modéré, ni gel ni chaleur. */
const RIDE = { firstHour: 8, lastHour: 20, minTempC: 0, maxTempC: 30, maxWindKmh: 40, maxPrecipMm: 0.2 };

const isStorm = (code: number) => code >= 95;
const isWetCode = (code: number) => (code >= 51 && code <= 86) || code >= 95;

function rideable(h: WeatherHour): boolean {
  if (isStorm(h.code)) return false;
  // La quantité prime sur le code : une bruine de 0,1 mm ne gâche pas l'heure.
  const wet = h.precipMm === null ? isWetCode(h.code) : h.precipMm >= RIDE.maxPrecipMm;
  if (wet) return false;
  if (h.windKmh !== null && h.windKmh >= RIDE.maxWindKmh) return false;
  return h.tempC > RIDE.minTempC && h.tempC < RIDE.maxTempC;
}

export type RideWindow = { start: Date; end: Date; tempC: number };

/** Plus longue plage d'heures montables d'aujourd'hui (8 h – 21 h), à partir
 * de maintenant ; la plus proche à égalité. Null s'il n'y en a pas. */
export function bestRideWindow(hours: WeatherHour[], now: Date): RideWindow | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const candidates = hours
    .map((h) => ({ h, at: new Date(h.time) }))
    .filter(({ at }) => {
      const day = new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
      return day === today && at.getTime() >= now.getTime() && at.getHours() >= RIDE.firstHour && at.getHours() <= RIDE.lastHour;
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  let best: { from: number; to: number } | null = null;
  let runStart = -1;
  for (let i = 0; i <= candidates.length; i++) {
    const c = candidates[i];
    // Une heure manquante dans la série coupe aussi la plage.
    const contiguous = c && runStart >= 0 && c.at.getTime() - candidates[i - 1].at.getTime() === 3600_000;
    const ok = c && rideable(c.h);
    if (ok && (runStart < 0 || contiguous)) {
      if (runStart < 0) runStart = i;
      continue;
    }
    if (runStart >= 0 && (!best || i - runStart > best.to - best.from)) best = { from: runStart, to: i };
    runStart = ok ? i : -1;
  }
  if (!best) return null;
  const run = candidates.slice(best.from, best.to);
  return {
    start: run[0].at,
    end: new Date(run[run.length - 1].at.getTime() + 3600_000),
    tempC: Math.round(Math.max(...run.map((c) => c.h.tempC))),
  };
}

export type WeatherAlert = "frost" | "heat" | "wind" | "storm";

/** Ce qui demande de l'attention dans les prochaines 24 h, une fois chacun :
 * gel (sol dur, abreuvoir), chaleur (monter tôt), vent fort, orage. */
export function weatherAlerts(hours: WeatherHour[], now: Date): WeatherAlert[] {
  const next = hours.filter((h) => {
    const t = Date.parse(h.time);
    return t >= now.getTime() && t < now.getTime() + 24 * 3600_000;
  });
  const alerts: WeatherAlert[] = [];
  if (next.some((h) => h.tempC <= 0)) alerts.push("frost");
  if (next.some((h) => h.tempC >= 30)) alerts.push("heat");
  if (next.some((h) => (h.windKmh ?? 0) >= 50)) alerts.push("wind");
  if (next.some((h) => isStorm(h.code))) alerts.push("storm");
  return alerts;
}
