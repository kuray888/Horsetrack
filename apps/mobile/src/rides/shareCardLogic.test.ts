import { describe, it, expect } from "vitest";
import { cardSize, maskRouteEnds, shareLabel, shareRoute, gaitShares } from "./shareCardLogic";

// ~11 m entre deux points (0.0001° de latitude).
const ROUTE = Array.from({ length: 101 }, (_, i) => ({ lat: 48 + i * 0.0001, lng: 2 }));

describe("maskRouteEnds", () => {
  it("retire le départ et l'arrivée sur la distance demandée", () => {
    const masked = maskRouteEnds(ROUTE, 200);
    expect(masked.length).toBeLessThan(ROUTE.length - 30);
    // Le premier point gardé est à au moins 200 m du départ réel.
    expect(masked[0].lat - ROUTE[0].lat).toBeGreaterThan(0.0017);
    expect(ROUTE[100].lat - masked[masked.length - 1].lat).toBeGreaterThan(0.0017);
  });
  it("parcours trop court pour être masqué : plus de tracé du tout, jamais le tracé complet", () => {
    expect(maskRouteEnds(ROUTE.slice(0, 20), 200)).toEqual([]);
    expect(maskRouteEnds([], 200)).toEqual([]);
  });
});

describe("cardSize", () => {
  it("story 9:16 et carré", () => {
    expect(cardSize("story", 300)).toEqual({ width: 300, height: 533 });
    expect(cardSize("square", 300)).toEqual({ width: 300, height: 300 });
  });
});

describe("shareLabel", () => {
  it("le code de parrainage est annoncé tel quel, sans promesse inventée", () => {
    expect(shareLabel("AMI-1234")).toBe("Mon code : AMI-1234");
    expect(shareLabel(null)).toBeNull();
  });
});

describe("shareRoute", () => {
  const speeds = ROUTE.map((_, i) => i);
  it("garde les vitesses alignées sur le tracé masqué, pour colorer les allures", () => {
    const { route, speeds: kept } = shareRoute(ROUTE, speeds, true);
    expect(kept).not.toBeNull();
    expect(kept!.length).toBe(route.length);
    const firstIdx = ROUTE.indexOf(route[0]);
    expect(kept![0]).toBe(firstIdx);
    expect(kept![kept!.length - 1]).toBe(firstIdx + route.length - 1);
  });
  it("sans masquage : tout le tracé et toutes les vitesses", () => {
    expect(shareRoute(ROUTE, speeds, false)).toEqual({ route: ROUTE, speeds });
  });
  it("sans trace détaillée (séance d'avant la 1.3.0) : tracé d'une seule couleur", () => {
    expect(shareRoute(ROUTE, null, true).speeds).toBeNull();
  });
  it("parcours trop court : ni tracé ni vitesses", () => {
    expect(shareRoute(ROUTE.slice(0, 20), speeds.slice(0, 20), true)).toEqual({ route: [], speeds: null });
  });
});

describe("gaitShares", () => {
  it("pourcentages des allures, sans afficher « Galop 0 % » pour quelques secondes", () => {
    expect(gaitShares({ walkSeconds: 1640, trotSeconds: 340, canterSeconds: 4 })).toEqual([
      { gait: "walk", seconds: 1640, percent: 83 },
      { gait: "trot", seconds: 340, percent: 17 },
    ]);
  });
  it("aucune allure : liste vide", () => {
    expect(gaitShares({ walkSeconds: 0, trotSeconds: 0, canterSeconds: 0 })).toEqual([]);
  });
});
