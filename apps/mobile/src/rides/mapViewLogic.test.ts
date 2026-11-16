import { describe, expect, it } from "vitest";
import { cameraFor, mapAvailable, mapTypeFor, regionFor, reviveMapStyle, SHARE_MAP_STYLES, REPLAY_MAP_STYLES } from "./mapViewLogic";

// ~1,1 km du sud au nord, ~0,7 km d'ouest en est, autour de 48° N.
const ROUTE = [
  { lat: 48.0, lng: 2.0 },
  { lat: 48.005, lng: 2.01 },
  { lat: 48.01, lng: 2.005 },
];

describe("mapAvailable", () => {
  it("la carte n'existe que sur iPhone : Apple Plans est gratuit et sans clé", () => {
    expect(mapAvailable("ios")).toBe(true);
    expect(mapAvailable("android")).toBe(false);
    expect(mapAvailable("web")).toBe(false);
  });
});

describe("styles proposés", () => {
  it("la relecture propose le tracé seul (comme avant), le plan, le satellite et la 3D", () => {
    expect(REPLAY_MAP_STYLES).toEqual(["trace", "standard", "satellite", "3d"]);
  });
  it("la carte partagée commence sans fond de carte : l'endroit ne se devine pas", () => {
    expect(SHARE_MAP_STYLES[0]).toBe("trace");
    expect(SHARE_MAP_STYLES).not.toContain("3d");
  });
});

describe("mapTypeFor", () => {
  it("chaque style a son fond Apple Plans", () => {
    expect(mapTypeFor("standard")).toBe("standard");
    expect(mapTypeFor("satellite")).toBe("hybrid");
    expect(mapTypeFor("3d")).toBe("hybridFlyover");
  });
});

describe("regionFor", () => {
  it("centre le tracé et garde une marge autour", () => {
    const r = regionFor(ROUTE)!;
    expect(r.latitude).toBeCloseTo(48.005, 5);
    expect(r.longitude).toBeCloseTo(2.005, 5);
    expect(r.latitudeDelta).toBeGreaterThan(0.01);
    expect(r.longitudeDelta).toBeGreaterThan(0.01);
  });
  it("un tracé minuscule n'est pas zoomé au point de ne plus rien voir autour", () => {
    const r = regionFor([{ lat: 48, lng: 2 }, { lat: 48.00001, lng: 2.00001 }])!;
    expect(r.latitudeDelta).toBeGreaterThanOrEqual(0.003);
    expect(r.longitudeDelta).toBeGreaterThanOrEqual(0.003);
  });
  it("pas de tracé : pas de région", () => {
    expect(regionFor([])).toBeNull();
  });
});

describe("cameraFor", () => {
  it("3D : vue inclinée ; plan et satellite : vue du dessus", () => {
    expect(cameraFor(ROUTE, "3d")!.pitch).toBeGreaterThan(30);
    expect(cameraFor(ROUTE, "standard")!.pitch).toBe(0);
  });
  it("l'altitude suit la taille du parcours : une grande balade est vue de plus haut", () => {
    const big = ROUTE.map((p) => ({ lat: 48 + (p.lat - 48) * 10, lng: 2 + (p.lng - 2) * 10 }));
    expect(cameraFor(big, "standard")!.altitude).toBeGreaterThan(cameraFor(ROUTE, "standard")!.altitude);
  });
});

describe("reviveMapStyle", () => {
  it("relit le style mémorisé ; sinon le style par défaut de l'écran", () => {
    expect(reviveMapStyle("satellite", "standard")).toBe("satellite");
    expect(reviveMapStyle("lune", "standard")).toBe("standard");
    expect(reviveMapStyle(null, "trace")).toBe("trace");
  });
});
