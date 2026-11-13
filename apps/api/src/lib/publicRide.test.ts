import { describe, it, expect } from "vitest";
import { formatDistance, formatDuration, gaitShares, publicRideSchema, routeToSvgPoints } from "./publicRide";

const BASE = { startedAt: "2026-11-13T10:00:00.000Z", durationSeconds: 1800 };

describe("publicRideSchema", () => {
  it("accepte une séance minimale et met des valeurs par défaut sûres", () => {
    const r = publicRideSchema.parse(BASE);
    expect(r.endsHidden).toBe(true);
    expect(r.horseName).toBe("");
    expect(r.distanceMeters).toBe(0);
  });
  it("refuse un tracé qui n'est pas une polyligne (injection) ou trop gros", () => {
    expect(publicRideSchema.safeParse({ ...BASE, route: "<script>alert(1)</script>" }).success).toBe(false);
    expect(publicRideSchema.safeParse({ ...BASE, route: "a".repeat(12_001) }).success).toBe(false);
    expect(publicRideSchema.safeParse({ ...BASE, route: "_p~iF~ps|U_ulLnnqC" }).success).toBe(true);
  });
  it("refuse des chiffres absurdes", () => {
    expect(publicRideSchema.safeParse({ ...BASE, durationSeconds: 0 }).success).toBe(false);
    expect(publicRideSchema.safeParse({ ...BASE, distanceMeters: 9e9 }).success).toBe(false);
    expect(publicRideSchema.safeParse({ ...BASE, startedAt: "hier" }).success).toBe(false);
  });
});

describe("routeToSvgPoints", () => {
  it("projette un tracé dans le cadre", () => {
    const pts = routeToSvgPoints("_p~iF~ps|U_ulLnnqC_mqNvxq`@", 300, 200, 10).split(" ");
    expect(pts).toHaveLength(3);
    for (const p of pts) {
      const [x, y] = p.split(",").map(Number);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(300);
      expect(y).toBeLessThanOrEqual(200);
    }
  });
  it("sans tracé ou avec un seul point : rien", () => {
    expect(routeToSvgPoints(null, 300, 200)).toBe("");
    expect(routeToSvgPoints("", 300, 200)).toBe("");
    expect(routeToSvgPoints("_p~iF~ps|U", 300, 200)).toBe("");
  });
});

describe("formats", () => {
  it("durée, distance, allures", () => {
    expect(formatDuration(1800)).toBe("30 min");
    expect(formatDuration(5400)).toBe("1 h 30");
    expect(formatDistance(850)).toBe("850 m");
    expect(formatDistance(12_340)).toBe("12,3 km");
    expect(gaitShares({ walkSeconds: 600, trotSeconds: 300, canterSeconds: 100 }).map((g) => g.pct)).toEqual([60, 30, 10]);
    expect(gaitShares({ walkSeconds: 0, trotSeconds: 0, canterSeconds: 0 })).toEqual([]);
  });
});
