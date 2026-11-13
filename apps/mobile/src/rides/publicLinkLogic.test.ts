import { describe, it, expect } from "vitest";
import { buildPublicRidePayload } from "./publicLinkLogic";
import type { SessionRide } from "./types";

const ride: SessionRide = {
  startedAt: new Date("2026-11-13T10:00:00Z"),
  endedAt: new Date("2026-11-13T10:30:00Z"),
  durationSeconds: 1800,
  distanceMeters: 4200,
  walkSeconds: 1000,
  trotSeconds: 600,
  canterSeconds: 200,
  haltSeconds: 0,
  maxSpeedKmh: 20,
  avgSpeedKmh: 8.4,
  gps: true,
  route: "_p~iF~ps|U",
};
const route = Array.from({ length: 101 }, (_, i) => ({ lat: 48 + i * 0.0001, lng: 2 }));

describe("buildPublicRidePayload", () => {
  it("envoie le tracé amputé du départ et de l'arrivée quand on les masque", () => {
    const masked = buildPublicRidePayload({ ride, sessionId: "s1", horseName: "Tornado", activity: "Balade", fullRoute: route, hideEnds: true });
    const open = buildPublicRidePayload({ ride, sessionId: "s1", horseName: "Tornado", activity: "Balade", fullRoute: route, hideEnds: false });
    expect(masked.endsHidden).toBe(true);
    expect(open.endsHidden).toBe(false);
    expect((masked.route ?? "").length).toBeLessThan((open.route ?? "").length);
  });
  it("parcours trop court pour être masqué : aucun tracé envoyé", () => {
    const p = buildPublicRidePayload({ ride, sessionId: "s1", horseName: null, activity: "Balade", fullRoute: route.slice(0, 15), hideEnds: true });
    expect(p.route).toBeNull();
  });
  it("n'envoie que des chiffres de la séance : pas de position brute, pas d'identité", () => {
    const p = buildPublicRidePayload({ ride, sessionId: "s1", horseName: "Tornado", activity: "Balade", fullRoute: route, hideEnds: true });
    expect(Object.keys(p).sort()).toEqual(
      ["activity", "avgSpeedKmh", "canterSeconds", "distanceMeters", "durationSeconds", "endsHidden", "horseName", "route", "sessionId", "startedAt", "trotSeconds", "walkSeconds"].sort()
    );
    expect(p.startedAt).toBe("2026-11-13T10:00:00.000Z");
    expect(p.horseName).toBe("Tornado");
  });
  it("séance sans GPS : pas de tracé", () => {
    const p = buildPublicRidePayload({ ride: { ...ride, gps: false, route: null }, sessionId: "s1", horseName: null, activity: "Manège", fullRoute: [], hideEnds: true });
    expect(p.route).toBeNull();
    expect(p.horseName).toBe("");
  });
});
