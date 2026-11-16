import { describe, expect, it } from "vitest";
import type { SessionRide } from "@/rides/types";
import { rideMonthStats, type RideLike } from "./monthStats";

function ride(distanceMeters: number, canterSeconds: number, gps = true): SessionRide {
  return {
    startedAt: new Date(),
    endedAt: new Date(),
    durationSeconds: 3600,
    distanceMeters,
    walkSeconds: 0,
    trotSeconds: 0,
    canterSeconds,
    haltSeconds: 0,
    maxSpeedKmh: 0,
    avgSpeedKmh: 0,
    gps,
    route: null,
  };
}
const s = (id: string, date: Date, r: SessionRide | null, horseId = "h1"): RideLike => ({ id, horseId, date, ride: r });

describe("rideMonthStats", () => {
  const current = s("c", new Date(2027, 2, 20), ride(12000, 600));
  const sessions = [
    s("a", new Date(2027, 2, 2), ride(8000, 300)),
    s("b", new Date(2027, 1, 10), ride(10000, 600)),
    s("x", new Date(2027, 2, 5), ride(50000, 900), "h2"),
    s("n", new Date(2027, 2, 6), null),
  ];

  it("cumule le mois de ce cheval, séance courante comprise", () => {
    const st = rideMonthStats(sessions, current);
    expect(st.month).toEqual({ rides: 2, distanceMeters: 20000, seconds: 7200, canterSeconds: 900 });
    expect(st.previous.rides).toBe(1);
    expect(st.canterChangePct).toBe(50);
  });

  it("record de distance seulement s'il y avait déjà des sorties", () => {
    expect(rideMonthStats(sessions, current).distanceRecord).toBe(true);
    expect(rideMonthStats([], current).distanceRecord).toBe(false);
  });

  it("sans galop le mois précédent, pas de pourcentage", () => {
    expect(rideMonthStats([], current).canterChangePct).toBeNull();
  });

  it("une séance déjà enregistrée n'est pas comptée deux fois", () => {
    expect(rideMonthStats([...sessions, current], current).month.rides).toBe(2);
  });

  it("une séance sans GPS compte en temps, pas en distance", () => {
    const st = rideMonthStats([], s("m", new Date(2027, 2, 20), ride(0, 0, false)));
    expect(st.month).toEqual({ rides: 1, distanceMeters: 0, seconds: 3600, canterSeconds: 0 });
  });
});
