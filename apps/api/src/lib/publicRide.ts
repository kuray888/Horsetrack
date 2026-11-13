import { z } from "zod";

/**
 * Lien public d'une séance (« voir ma balade sur Horsetrack »), 1.3.0.
 * Routes : POST/DELETE /api/public-ride ; page publique /s/[token].
 * Le cavalier le crée volontairement depuis la carte à partager ; ne part que ce
 * qu'il envoie (tracé déjà amputé du départ et de l'arrivée s'il l'a demandé).
 * Pas de nom de cavalier, pas de fond de carte (aucun tiers), page non indexée.
 */

/** Liens créés par compte et par 24 h : borne les abus. */
export const MAX_PUBLIC_RIDES_PER_DAY = 20;

export const publicRideSchema = z.object({
  sessionId: z.string().max(64).optional(),
  horseName: z.string().trim().max(60).default(""),
  activity: z.string().trim().max(60).default(""),
  startedAt: z.string().datetime(),
  durationSeconds: z.number().int().min(1).max(86_400),
  distanceMeters: z.number().int().min(0).max(500_000).default(0),
  avgSpeedKmh: z.number().min(0).max(80).default(0),
  walkSeconds: z.number().int().min(0).max(86_400).default(0),
  trotSeconds: z.number().int().min(0).max(86_400).default(0),
  canterSeconds: z.number().int().min(0).max(86_400).default(0),
  /** Polyligne encodée : caractères ASCII 63 à 126 seulement, taille bornée. */
  route: z
    .string()
    .max(12_000)
    .regex(/^[?-~]*$/)
    .nullable()
    .optional(),
  endsHidden: z.boolean().default(true),
});
export type PublicRideInput = z.infer<typeof publicRideSchema>;

export function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const coords: { lat: number; lng: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = (): number | null => {
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

/** Points « x,y » d'un tracé tenant dans width × height (nord en haut), pour un <polyline> SVG. */
export function routeToSvgPoints(encoded: string | null | undefined, width: number, height: number, padding = 12): string {
  const coords = encoded ? decodePolyline(encoded) : [];
  if (coords.length < 2) return "";
  const midLat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const xs = coords.map((c) => c.lng * kx);
  const ys = coords.map((c) => c.lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1e-9;
  const spanY = Math.max(...ys) - minY || 1e-9;
  const scale = Math.min((width - 2 * padding) / spanX, (height - 2 * padding) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  return coords
    .map((_, i) => `${(offX + (xs[i] - minX) * scale).toFixed(1)},${(height - offY - (ys[i] - minY) * scale).toFixed(1)}`)
    .join(" ");
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

export function gaitShares(r: { walkSeconds: number; trotSeconds: number; canterSeconds: number }): { label: string; pct: number }[] {
  const total = r.walkSeconds + r.trotSeconds + r.canterSeconds;
  if (total <= 0) return [];
  return [
    { label: "Pas", pct: Math.round((r.walkSeconds / total) * 100) },
    { label: "Trot", pct: Math.round((r.trotSeconds / total) * 100) },
    { label: "Galop", pct: Math.round((r.canterSeconds / total) * 100) },
  ].filter((g) => g.pct > 0);
}
