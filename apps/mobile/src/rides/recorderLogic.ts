import { acceptPoint, type RidePoint } from "@/rides/rideMath";

/** Logique pure de l'enregistreur (cf. recorder.ts), testée dans recorderLogic.test.ts. */

export type TaskLocation = {
  timestamp: number;
  coords: { latitude: number; longitude: number; accuracy: number | null; speed: number | null; altitude?: number | null };
};

/** Écart minimal entre deux points gardés. */
export const MIN_POINT_INTERVAL_MS = 2000;

/**
 * Points GPS livrés par iOS ajoutés au tracé : rend un NOUVEAU tableau (ou
 * null si aucun point n'est retenu). Pousser dans le tableau existant gardait
 * la même identité : l'écran du direct, qui recalcule son tracé quand
 * `points` change, ne le redessinait jamais.
 */
export function appendPoints(points: RidePoint[], locations: TaskLocation[], startedAt: number): RidePoint[] | null {
  const next = points.slice();
  for (const loc of locations) {
    const p: RidePoint = {
      t: loc.timestamp,
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      acc: loc.coords.accuracy ?? null,
      speed: loc.coords.speed ?? null,
      alt: loc.coords.altitude ?? null,
    };
    if (p.t < startedAt) continue;
    const prev = next[next.length - 1] ?? null;
    if (prev && p.t - prev.t < MIN_POINT_INTERVAL_MS) continue;
    if (!acceptPoint(prev, p)) continue;
    next.push(p);
  }
  return next.length > points.length ? next : null;
}
