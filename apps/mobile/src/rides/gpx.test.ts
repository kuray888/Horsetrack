import { describe, it, expect } from "vitest";
import { buildGpx, gpxFileName } from "./gpx";

const ROUTE = [
  { lat: 48.85, lng: 2.35 },
  { lat: 48.851, lng: 2.351 },
  { lat: 48.852, lng: 2.352 },
];

describe("buildGpx", () => {
  it("produit un fichier GPX 1.1 avec un point par position", () => {
    const gpx = buildGpx({ name: "Balade", startedAt: new Date("2026-11-13T10:00:00Z"), endedAt: new Date("2026-11-13T10:30:00Z"), route: ROUTE });
    expect(gpx.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(gpx).toContain('<gpx version="1.1"');
    expect((gpx.match(/<trkpt /g) ?? []).length).toBe(3);
    expect(gpx).toContain('<trkpt lat="48.85000" lon="2.35000">');
  });

  it("répartit les heures entre le départ et l'arrivée", () => {
    const gpx = buildGpx({ name: "x", startedAt: new Date("2026-11-13T10:00:00Z"), endedAt: new Date("2026-11-13T10:30:00Z"), route: ROUTE });
    expect(gpx).toContain("<time>2026-11-13T10:00:00.000Z</time>");
    expect(gpx).toContain("<time>2026-11-13T10:30:00.000Z</time>");
  });

  it("échappe le nom (apostrophes, esperluette, chevrons)", () => {
    const gpx = buildGpx({ name: `Tom & <Jerry> "l'été"`, startedAt: new Date(0), endedAt: new Date(1000), route: ROUTE });
    expect(gpx).toContain("Tom &amp; &lt;Jerry&gt; &quot;l&apos;été&quot;");
  });

  it("un seul point : toujours un fichier valide", () => {
    const gpx = buildGpx({ name: "x", startedAt: new Date(0), endedAt: new Date(1000), route: [ROUTE[0]] });
    expect((gpx.match(/<trkpt /g) ?? []).length).toBe(1);
  });
});

describe("buildGpx avec trace détaillée", () => {
  it("écrit les vraies heures et l'altitude de chaque point", () => {
    const gpx = buildGpx({
      name: "x", startedAt: new Date("2026-11-13T10:00:00Z"), endedAt: new Date("2026-11-13T10:30:00Z"), route: ROUTE,
      trace: { t: [0, 60, 1800], s: [0, 50, 100], a: [1000, 1012, 1050] },
    });
    expect(gpx).toContain("<time>2026-11-13T10:01:00.000Z</time>");
    expect(gpx).toContain("<ele>101.2</ele>");
  });
  it("trace de longueur différente : retombe sur les heures réparties", () => {
    const gpx = buildGpx({ name: "x", startedAt: new Date("2026-11-13T10:00:00Z"), endedAt: new Date("2026-11-13T10:30:00Z"), route: ROUTE, trace: { t: [0], s: [0], a: null } });
    expect(gpx).toContain("<time>2026-11-13T10:15:00.000Z</time>");
    expect(gpx).not.toContain("<ele>");
  });
});

describe("gpxFileName", () => {
  it("garde un nom lisible et sans caractère interdit", () => {
    expect(gpxFileName("Tornado / été", new Date("2026-11-13T10:00:00Z"))).toBe("Tornado ete - 2026-11-13.gpx");
    expect(gpxFileName("", new Date("2026-11-13T10:00:00Z"))).toBe("Seance - 2026-11-13.gpx");
  });
});
