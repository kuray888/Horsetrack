/**
 * Export GPX d'une séance en direct (logique pure, cf. exportRideGpx.ts pour
 * l'écriture du fichier). Le tracé gardé à la fin d'une séance n'a pas d'heure
 * par point : les heures sont réparties régulièrement entre le départ et
 * l'arrivée, ce qui suffit à Strava, Komoot ou Apple Fichiers pour l'ouvrir.
 */
import type { ParsedTrace } from "@/rides/trace";

type Point = { lat: number; lng: number };

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function buildGpx(input: {
  name: string;
  startedAt: Date;
  endedAt: Date;
  route: Point[];
  /** Trace détaillée (cf. trace.ts) : vraies heures et altitudes quand elle est alignée sur le tracé. */
  trace?: ParsedTrace | null;
}): string {
  const { route } = input;
  const start = input.startedAt.getTime();
  const span = Math.max(0, input.endedAt.getTime() - start);
  const last = Math.max(1, route.length - 1);
  const pts = route
    .map((p, i) => {
      const real = input.trace && input.trace.t.length === route.length ? input.trace : null;
      const time = new Date(real ? start + real.t[i] * 1000 : start + (span * i) / last).toISOString();
      const ele = real?.a ? `\n        <ele>${(real.a[i] / 10).toFixed(1)}</ele>` : "";
      return `      <trkpt lat="${p.lat.toFixed(5)}" lon="${p.lng.toFixed(5)}">${ele}\n        <time>${time}</time>\n      </trkpt>`;
    })
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Horsetrack" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata><name>${escapeXml(input.name)}</name><time>${input.startedAt.toISOString()}</time></metadata>`,
    "  <trk>",
    `    <name>${escapeXml(input.name)}</name>`,
    "    <trkseg>",
    pts,
    "    </trkseg>",
    "  </trk>",
    "</gpx>",
    "",
  ].join("\n");
}

/** Nom de fichier lisible par le destinataire, sans accent ni caractère interdit. */
export function gpxFileName(name: string, date: Date): string {
  const safe = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${safe || "Seance"} - ${date.toISOString().slice(0, 10)}.gpx`;
}
