import { describe, it, expect } from "vitest";
import { buildTrace, parseTrace, smoothAltitudes, elevationChange, gaitRuns, traceStats } from "./trace";
import type { RidePoint } from "./rideMath";

const P = (sec: number, lat: number, speedMs: number | null, alt?: number | null): RidePoint => ({ t: 1_000_000 + sec * 1000, lat, lng: 2, acc: 5, speed: speedMs, alt });

describe("buildTrace / parseTrace", () => {
  it("aller-retour : une entrée par point, heure relative au départ", () => {
    const pts = [P(0, 48, 0, 100), P(10, 48.0001, 1.5, 100.4), P(20, 48.0002, 4, 101)];
    const trace = buildTrace(pts, 1_000_000, 600)!;
    const parsed = parseTrace(trace, 3)!;
    expect(parsed.t).toEqual([0, 10, 20]);
    expect(parsed.s).toEqual([0, 54, 144]);
    expect(parsed.a).toEqual([1000, 1004, 1010]);
  });
  it("sous-échantillonne comme la polyligne (même nombre de points)", () => {
    const pts = Array.from({ length: 1000 }, (_, i) => P(i, 48 + i * 1e-5, 2, 50));
    const parsed = parseTrace(buildTrace(pts, 1_000_000, 600)!, 600)!;
    expect(parsed.t.length).toBe(600);
    expect(parsed.t[0]).toBe(0);
    expect(parsed.t[599]).toBe(999);
  });
  it("sans altitude : pas de série d'altitude", () => {
    const parsed = parseTrace(buildTrace([P(0, 48, 1), P(5, 48.0001, 1)], 1_000_000, 600)!, 2)!;
    expect(parsed.a).toBeNull();
  });
  it("trace absente, abîmée ou de longueur différente : null", () => {
    expect(parseTrace(null, 3)).toBeNull();
    expect(parseTrace("pas du json", 3)).toBeNull();
    expect(parseTrace('{"v":1,"t":[0],"s":[0]}', 3)).toBeNull();
    expect(parseTrace('{"v":2,"t":[0],"s":[0]}', 1)).toBeNull();
  });
  it("moins de 2 points : pas de trace", () => {
    expect(buildTrace([P(0, 48, 1)], 1_000_000, 600)).toBeNull();
  });
});

describe("altitude lissée et dénivelé", () => {
  it("un pic isolé du GPS n'ajoute pas de dénivelé", () => {
    const alts = [100, 100, 130, 100, 100, 100, 100];
    expect(elevationChange(smoothAltitudes(alts))).toEqual({ gain: 0, loss: 0 });
  });
  it("le bruit de ±1 m ne compte pas (seuil de 3 m)", () => {
    const alts = [100, 101, 100, 101, 100, 101, 100, 101, 100];
    expect(elevationChange(alts)).toEqual({ gain: 0, loss: 0 });
  });
  it("une vraie montée puis descente", () => {
    const alts = [100, 100, 105, 110, 115, 115, 110, 105, 100, 100];
    const c = elevationChange(smoothAltitudes(alts));
    expect(c.gain).toBeGreaterThanOrEqual(10);
    expect(c.gain).toBeLessThanOrEqual(16);
    expect(c.loss).toBeGreaterThanOrEqual(10);
  });
  it("valeurs manquantes ignorées", () => {
    expect(elevationChange([100, null as unknown as number, 110, 120])).toEqual({ gain: 20, loss: 0 });
    expect(smoothAltitudes([])).toEqual([]);
  });
});

describe("gaitRuns", () => {
  it("regroupe les points consécutifs de même allure, en partageant la jonction", () => {
    const runs = gaitRuns([0, 5, 5, 10, 20, 20]); // halt, walk, walk, trot, canter, canter
    expect(runs.map((r) => r.gait)).toEqual(["halt", "walk", "trot", "canter"]);
    expect(runs[0]).toMatchObject({ from: 0, to: 1 });
    expect(runs[1]).toMatchObject({ from: 1, to: 3 });
    expect(runs[3]).toMatchObject({ from: 4, to: 5 });
  });
  it("un seul point : rien à dessiner", () => {
    expect(gaitRuns([5])).toEqual([]);
  });
});

describe("traceStats", () => {
  it("vitesse max lissée et dénivelé", () => {
    const parsed = { t: [0, 1, 2, 3], s: [30, 80, 90, 85], a: [1000, 1050, 1100, 1100] };
    const st = traceStats(parsed);
    expect(st.maxKmh).toBeCloseTo(8.5, 1);
    expect(st.gain).toBeGreaterThan(0);
  });
});
