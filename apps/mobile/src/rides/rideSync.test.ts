import { describe, expect, it } from "vitest";
import { keepLocalRide, reviveRide } from "@/rides/rideSync";
import type { SessionRide } from "@/rides/types";

const ride: SessionRide = {
  startedAt: new Date("2026-10-27T09:00:00Z"),
  endedAt: new Date("2026-10-27T10:00:00Z"),
  durationSeconds: 3600,
  distanceMeters: 8000,
  walkSeconds: 1800,
  trotSeconds: 1200,
  canterSeconds: 300,
  haltSeconds: 300,
  maxSpeedKmh: 24,
  avgSpeedKmh: 9,
  gps: true,
  route: "abc",
};

type Row = { id: string; notes: string; ride?: SessionRide | null };

describe("keepLocalRide", () => {
  const local: Row = { id: "s1", notes: "local", ride };
  it("garde le parcours local quand le serveur ne l'a pas lu", () => {
    expect(keepLocalRide<Row>(local, { id: "s1", notes: "serveur", ride: undefined })).toEqual({
      id: "s1",
      notes: "serveur",
      ride,
    });
  });
  it("prend la version du serveur quand il a répondu", () => {
    const remote: Row = { id: "s1", notes: "serveur", ride: null };
    expect(keepLocalRide(local, remote)).toBe(remote);
  });
  it("sans parcours local, rien à garder", () => {
    const remote: Row = { id: "s1", notes: "serveur", ride: undefined };
    expect(keepLocalRide<Row>({ id: "s1", notes: "x", ride: null }, remote)).toBe(remote);
  });
});

describe("reviveRide", () => {
  it("rend des dates aux dates relues en JSON", () => {
    const revived = reviveRide(JSON.parse(JSON.stringify(ride)));
    expect(revived?.startedAt).toBeInstanceOf(Date);
    expect(revived?.endedAt.getTime()).toBe(ride.endedAt.getTime());
    expect(reviveRide(null)).toBeNull();
    expect(reviveRide(undefined)).toBeUndefined();
  });
});
