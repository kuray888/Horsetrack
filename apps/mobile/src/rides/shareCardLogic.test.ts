import { describe, it, expect } from "vitest";
import { cardSize, maskRouteEnds, shareLabel } from "./shareCardLogic";

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
