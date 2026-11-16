import { describe, expect, it } from "vitest";
import { appendPoints, type TaskLocation } from "./recorderLogic";

const loc = (t: number, lat: number): TaskLocation => ({
  timestamp: t,
  coords: { latitude: lat, longitude: 2, accuracy: 5, speed: 2, altitude: 50 },
});

describe("appendPoints", () => {
  it("rend un NOUVEAU tableau : l'écran du direct, qui compare par identité, redessine le tracé", () => {
    const before = [{ t: 1000, lat: 48, lng: 2, acc: 5, speed: 2, alt: 50 }];
    const after = appendPoints(before, [loc(4000, 48.0001)], 0);
    expect(after).not.toBeNull();
    expect(after).not.toBe(before);
    expect(after!.length).toBe(2);
    expect(before.length).toBe(1);
  });
  it("aucun point retenu (trop rapproché, avant le départ) : null, rien ne change", () => {
    const before = [{ t: 1000, lat: 48, lng: 2, acc: 5, speed: 2, alt: 50 }];
    expect(appendPoints(before, [loc(1500, 48.0001)], 0)).toBeNull();
    expect(appendPoints([], [loc(500, 48)], 1000)).toBeNull();
  });
  it("premier point d'une séance vide", () => {
    expect(appendPoints([], [loc(2000, 48)], 1000)).toEqual([{ t: 2000, lat: 48, lng: 2, acc: 5, speed: 2, alt: 50 }]);
  });
});
