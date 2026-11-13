import { classifyGait, segmentSpeedKmh, type Gait, type RidePoint } from "@/rides/rideMath";

/**
 * Trace détaillée d'une séance (cf. docs/seance-gps-relue.md, J1) : à côté de
 * la polyligne `route` (lat/lng, ~600 points), un JSON compact ALIGNÉ sur elle,
 * point pour point — heure (secondes depuis le départ), vitesse (dixièmes de
 * km/h) et altitude (décimètres). Logique pure, testée dans trace.test.ts.
 */
export type ParsedTrace = {
  /** Secondes depuis le départ. */
  t: number[];
  /** Dixièmes de km/h. */
  s: number[];
  /** Décimètres ; null si le GPS n'a pas donné d'altitude. */
  a: number[] | null;
};

/** Mêmes indices que `downsample` (rideMath.ts), pour rester aligné sur la polyligne. */
function sampleIndices(length: number, max: number): number[] {
  if (length <= max) return Array.from({ length }, (_, i) => i);
  const step = (length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => Math.round(i * step));
}

export function buildTrace(points: RidePoint[], startedAt: number, max = 600): string | null {
  if (points.length < 2) return null;
  const speeds = points.map((p, i) => (i === 0 ? -1 : segmentSpeedKmh(points[i - 1], p)));
  speeds[0] = points[0].speed !== null && points[0].speed >= 0 ? points[0].speed * 3.6 : speeds[1];
  const idx = sampleIndices(points.length, max);
  const t = idx.map((i) => Math.max(0, Math.round((points[i].t - startedAt) / 1000)));
  const s = idx.map((i) => Math.round(speeds[i] * 10));
  let last: number | null = null;
  const alts = idx.map((i) => {
    const alt = points[i].alt;
    if (alt !== null && alt !== undefined && Number.isFinite(alt)) last = alt;
    return last;
  });
  const firstKnown = alts.find((a) => a !== null);
  const a = firstKnown === undefined ? null : alts.map((v) => Math.round((v ?? (firstKnown as number)) * 10));
  return JSON.stringify(a ? { v: 1, t, s, a } : { v: 1, t, s });
}

/** Lit une trace ; null si elle manque, est abîmée ou n'a pas `expectedLength` points. */
export function parseTrace(raw: string | null | undefined, expectedLength: number): ParsedTrace | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || o.v !== 1 || !Array.isArray(o.t) || !Array.isArray(o.s)) return null;
    if (o.t.length !== expectedLength || o.s.length !== expectedLength) return null;
    const a = Array.isArray(o.a) && o.a.length === expectedLength ? (o.a as number[]) : null;
    return { t: o.t, s: o.s, a };
  } catch {
    return null;
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Médiane glissante sur 5 points : efface les pics isolés du GPS. */
export function smoothAltitudes(alts: number[]): number[] {
  return alts.map((_, i) => median(alts.slice(Math.max(0, i - 2), i + 3)));
}

/** Dénivelé positif et négatif, avec un seuil d'hystérésis de 3 m : le bruit
 * de ±1 m du GPS ne s'additionne pas en montée fantôme. */
export function elevationChange(alts: (number | null)[], thresholdM = 3): { gain: number; loss: number } {
  const values = alts.filter((v): v is number => v !== null && Number.isFinite(v));
  let gain = 0;
  let loss = 0;
  if (values.length === 0) return { gain, loss };
  let ref = values[0];
  for (const v of values) {
    if (v - ref >= thresholdM) {
      gain += v - ref;
      ref = v;
    } else if (ref - v >= thresholdM) {
      loss += ref - v;
      ref = v;
    }
  }
  return { gain: Math.round(gain), loss: Math.round(loss) };
}

/** Tronçons de tracé de même allure, pour colorer le parcours : `from` et `to`
 * sont des indices de points ; chaque tronçon rejoint le suivant. */
export function gaitRuns(speedsKmh: number[]): { gait: Gait; from: number; to: number }[] {
  const runs: { gait: Gait; from: number; to: number }[] = [];
  const last = speedsKmh.length - 1;
  let start = 0;
  for (let i = 1; i <= speedsKmh.length; i++) {
    if (i === speedsKmh.length || classifyGait(speedsKmh[i]) !== classifyGait(speedsKmh[start])) {
      runs.push({ gait: classifyGait(speedsKmh[start]), from: start, to: i === speedsKmh.length ? last : i });
      start = i;
    }
  }
  return runs.filter((r) => r.from < r.to);
}

/** Vitesse max (médiane de 3 points) et dénivelé d'une trace relue. */
export function traceStats(trace: ParsedTrace): { maxKmh: number; gain: number; loss: number } {
  const kmh = trace.s.map((v) => v / 10);
  let maxKmh = Math.max(0, ...kmh);
  if (kmh.length >= 3) {
    maxKmh = 0;
    for (let i = 1; i < kmh.length - 1; i++) maxKmh = Math.max(maxKmh, median([kmh[i - 1], kmh[i], kmh[i + 1]]));
  }
  const { gain, loss } = trace.a ? elevationChange(smoothAltitudes(trace.a.map((v) => v / 10))) : { gain: 0, loss: 0 };
  return { maxKmh: Math.round(maxKmh * 10) / 10, gain, loss };
}
