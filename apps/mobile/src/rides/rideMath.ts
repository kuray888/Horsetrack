import { t, localDecimal } from "@/i18n";

/**
 * Calculs d'une séance enregistrée en direct : distance, allures, vitesse,
 * tracé. Logique pure, testée (rideMath.test.ts) — l'enregistreur
 * (rides/recorder.ts) ne fait que collecter les points GPS.
 *
 * Les allures sont ESTIMÉES d'après la vitesse : sans capteur sur le cheval,
 * c'est ce que font aussi les applis du marché. Seuils retenus pour un
 * cheval de selle : arrêt < 2 km/h, pas < 7,5, trot < 15, galop au-delà.
 * Un poney trotte plus lentement : l'écran le dit (« estimées »).
 */

export type RidePoint = {
  /** Horodatage en ms. */
  t: number;
  lat: number;
  lng: number;
  /** Précision horizontale en mètres (null si inconnue). */
  acc: number | null;
  /** Vitesse instantanée en m/s donnée par le GPS (null ou < 0 si inconnue). */
  speed: number | null;
};

export type RidePause = { start: number; end: number | null };

export type Gait = "halt" | "walk" | "trot" | "canter";
export const GAITS: Gait[] = ["walk", "trot", "canter", "halt"];

export type GaitSeconds = Record<Gait, number>;

export type RideStats = {
  /** Temps de séance hors pauses, en secondes. */
  durationSeconds: number;
  distanceMeters: number;
  gaitSeconds: GaitSeconds;
  maxSpeedKmh: number;
  /** Vitesse moyenne en mouvement (hors arrêts), km/h. */
  avgSpeedKmh: number;
};

/** Points moins précis que ça : ignorés (immeubles, sous-bois denses). */
export const MAX_ACCURACY_M = 35;
/** Au-delà, c'est un saut de position, pas un cheval. */
const MAX_PLAUSIBLE_KMH = 65;
/** Trou de signal : au-delà, le temps compte, pas la distance ni l'allure. */
const MAX_SEGMENT_MS = 60_000;

const THRESHOLDS_KMH = { halt: 2, walk: 7.5, trot: 15 };

export function classifyGait(speedKmh: number): Gait {
  if (speedKmh < THRESHOLDS_KMH.halt) return "halt";
  if (speedKmh < THRESHOLDS_KMH.walk) return "walk";
  if (speedKmh < THRESHOLDS_KMH.trot) return "trot";
  return "canter";
}

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Le point mérite-t-il d'être gardé, sachant le dernier point gardé ? */
export function acceptPoint(prev: RidePoint | null, p: RidePoint): boolean {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return false;
  if (p.acc !== null && p.acc > MAX_ACCURACY_M) return false;
  if (!prev) return true;
  if (p.t <= prev.t) return false;
  const kmh = (haversineMeters(prev, p) / ((p.t - prev.t) / 1000)) * 3.6;
  return kmh <= MAX_PLAUSIBLE_KMH;
}

function pausedOverlapMs(start: number, end: number, pauses: RidePause[], now: number): number {
  let total = 0;
  for (const p of pauses) {
    const pEnd = p.end ?? now;
    const from = Math.max(start, p.start);
    const to = Math.min(end, pEnd);
    if (to > from) total += to - from;
  }
  return total;
}

/** Durée active (hors pauses) entre le départ et `now`. */
export function activeSeconds(startedAt: number, pauses: RidePause[], now: number): number {
  return Math.max(0, Math.round((now - startedAt - pausedOverlapMs(startedAt, now, pauses, now)) / 1000));
}

/** Vitesse d'un segment en km/h : la vitesse Doppler du GPS quand il la
 * donne (plus fiable que la distance entre deux points bruités), sinon la
 * distance parcourue rapportée au temps. */
function segmentSpeedKmh(a: RidePoint, b: RidePoint): number {
  if (b.speed !== null && b.speed >= 0) return b.speed * 3.6;
  const dt = (b.t - a.t) / 1000;
  return dt > 0 ? (haversineMeters(a, b) / dt) * 3.6 : 0;
}

/** Vitesse courante lissée (médiane des 3 dernières) pour l'affichage en
 * direct : un seul point aberrant ne fait pas passer l'écran au galop. */
export function currentSpeedKmh(points: RidePoint[]): number {
  if (points.length < 2) return points[0]?.speed && points[0].speed > 0 ? points[0].speed * 3.6 : 0;
  const speeds: number[] = [];
  for (let i = Math.max(1, points.length - 3); i < points.length; i++) {
    speeds.push(segmentSpeedKmh(points[i - 1], points[i]));
  }
  speeds.sort((x, y) => x - y);
  return speeds[Math.floor(speeds.length / 2)];
}

export function summarizeRide(
  points: RidePoint[],
  pauses: RidePause[],
  startedAt: number,
  endedAt: number
): RideStats {
  const gaitSeconds: GaitSeconds = { halt: 0, walk: 0, trot: 0, canter: 0 };
  let distance = 0;
  let movingMs = 0;
  let movingDistance = 0;
  const speeds: number[] = [];

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dt = b.t - a.t;
    if (dt <= 0 || dt > MAX_SEGMENT_MS) continue;
    // Segment entièrement en pause : ignoré (le cavalier a mis en pause).
    if (pausedOverlapMs(a.t, b.t, pauses, endedAt) >= dt) continue;
    const kmh = segmentSpeedKmh(a, b);
    speeds.push(kmh);
    const gait = classifyGait(kmh);
    gaitSeconds[gait] += dt / 1000;
    // À l'arrêt, les petits écarts entre deux points sont du bruit GPS : les
    // additionner gonflerait la distance d'une séance passée à attendre.
    if (gait !== "halt") {
      const d = haversineMeters(a, b);
      distance += d;
      movingDistance += d;
      movingMs += dt;
    }
  }

  // Vitesse max sur la médiane glissante de 3 segments, pour la même raison
  // que currentSpeedKmh.
  let maxSpeed = 0;
  for (let i = 0; i < speeds.length; i++) {
    const w = speeds.slice(Math.max(0, i - 1), i + 2).sort((x, y) => x - y);
    maxSpeed = Math.max(maxSpeed, w[Math.floor(w.length / 2)]);
  }

  const durationSeconds = activeSeconds(startedAt, pauses, endedAt);
  // Le temps sans point GPS exploitable (début, trous de signal, manège
  // couvert) ne disparaît pas : il compte à l'arrêt plutôt que nulle part,
  // pour que la somme des allures égale la durée.
  const counted = gaitSeconds.halt + gaitSeconds.walk + gaitSeconds.trot + gaitSeconds.canter;
  if (durationSeconds > counted) gaitSeconds.halt += durationSeconds - counted;
  for (const g of GAITS) gaitSeconds[g] = Math.round(gaitSeconds[g]);

  return {
    durationSeconds,
    distanceMeters: Math.round(distance),
    gaitSeconds,
    maxSpeedKmh: Math.round(maxSpeed * 10) / 10,
    avgSpeedKmh: movingMs > 0 ? Math.round((movingDistance / (movingMs / 1000)) * 3.6 * 10) / 10 : 0,
  };
}

/**
 * Le cavalier est-il immobile depuis `windowMs` ? Sert à l'alerte de
 * sécurité (cf. rides/safety.ts) : tous les points reçus pendant la fenêtre
 * tiennent dans un cercle de `radiusM`. Sans point récent (GPS perdu), on ne
 * conclut rien : c'est le serveur qui s'inquiète d'un téléphone muet.
 */
export function isImmobile(
  points: RidePoint[],
  now: number,
  activeSince: number,
  windowMs = 5 * 60_000,
  radiusM = 25
): boolean {
  if (now - activeSince < windowMs) return false;
  const recent = points.filter((p) => p.t >= now - windowMs);
  if (recent.length < 3) return false;
  // Les points doivent couvrir la fenêtre, pas seulement sa dernière minute.
  if (recent[recent.length - 1].t - recent[0].t < windowMs * 0.6) return false;
  const last = recent[recent.length - 1];
  return recent.every((p) => haversineMeters(p, last) <= radiusM);
}

// --- Tracé compact -----------------------------------------------------------

/** Garde au plus `max` points, régulièrement espacés, premier et dernier inclus. */
export function downsample<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const out: T[] = [];
  const step = (points.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}

/** Polyligne encodée (algorithme de Google, précision 1e-5) : ~5 octets par
 * point au lieu de ~40 en JSON — un tracé de 2 h tient dans une colonne texte. */
export function encodePolyline(coords: { lat: number; lng: number }[]): string {
  let out = "";
  let prevLat = 0;
  let prevLng = 0;
  const encode = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    let chunk = "";
    while (v >= 0x20) {
      chunk += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    return chunk + String.fromCharCode(v + 63);
  };
  for (const c of coords) {
    const lat = Math.round(c.lat * 1e5);
    const lng = Math.round(c.lng * 1e5);
    out += encode(lat - prevLat) + encode(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return out;
}

export function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const coords: { lat: number; lng: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length) return null;
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    const dLat = next();
    const dLng = next();
    if (dLat === null || dLng === null) break;
    lat += dLat;
    lng += dLng;
    coords.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return coords;
}

/**
 * Projette un tracé dans un cadre `width` × `height` (en conservant les
 * proportions, nord en haut) — pour le dessiner en SVG sans fond de carte.
 */
export function projectRoute(
  coords: { lat: number; lng: number }[],
  width: number,
  height: number,
  padding = 8
): { x: number; y: number }[] {
  if (coords.length === 0) return [];
  const midLat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const xs = coords.map((c) => c.lng * kx);
  const ys = coords.map((c) => c.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1e-9;
  const spanY = maxY - minY || 1e-9;
  const scale = Math.min((width - 2 * padding) / spanX, (height - 2 * padding) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  return coords.map((_, i) => ({
    x: Math.round((offX + (xs[i] - minX) * scale) * 10) / 10,
    y: Math.round((height - offY - (ys[i] - minY) * scale) * 10) / 10,
  }));
}

// --- Affichage ---------------------------------------------------------------

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return t("{v} m", { v: Math.round(meters) });
  return t("{v} km", { v: localDecimal((meters / 1000).toFixed(meters < 10_000 ? 2 : 1)) });
}

export function formatSpeed(kmh: number): string {
  return t("{v} km/h", { v: localDecimal(kmh.toFixed(1)) });
}
