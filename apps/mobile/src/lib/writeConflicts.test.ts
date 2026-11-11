import { beforeEach, describe, expect, it } from "vitest";
import { clearWriteConflicts, noteWriteConflict, subscribeToWriteConflicts, writeConflictCount, isStaleWrite } from "./writeConflicts";

beforeEach(() => clearWriteConflicts());

describe("isStaleWrite", () => {
  const at = (iso: string) => iso;
  it("le serveur a une version plus récente : l'écriture rejouée est périmée", () => {
    expect(isStaleWrite(at("2026-11-11T09:00:00.000Z"), at("2026-11-11T10:00:00.000Z"))).toBe(true);
  });
  it("même instant ou plus ancien côté serveur : on écrit", () => {
    expect(isStaleWrite(at("2026-11-11T10:00:00.000Z"), at("2026-11-11T10:00:00.000Z"))).toBe(false);
    expect(isStaleWrite(at("2026-11-11T10:00:00.000Z"), at("2026-11-11T09:00:00.000Z"))).toBe(false);
  });
  it("tolère un léger décalage d'horloge entre appareils (2 min) : pas de faux conflit", () => {
    expect(isStaleWrite(at("2026-11-11T10:00:00.000Z"), at("2026-11-11T10:01:00.000Z"))).toBe(false);
  });
  it("lit la date du serveur comme de l'UTC (timestamp sans fuseau), quel que soit le fuseau de l'appareil", () => {
    // Le serveur renvoie « 2026-11-11T10:00:00 » (UTC, sans « Z ») pour 10 h UTC.
    expect(isStaleWrite("2026-11-11T09:00:00.000Z", "2026-11-11T10:00:00")).toBe(true);
    expect(isStaleWrite("2026-11-11T10:00:00.000Z", "2026-11-11T10:00:00")).toBe(false);
    expect(isStaleWrite("2026-11-11T11:00:00.000Z", "2026-11-11T10:00:00")).toBe(false);
  });
  it("date absente ou illisible : on écrit (jamais de perte sur un doute)", () => {
    expect(isStaleWrite(undefined, "2026-11-11T10:00:00.000Z")).toBe(false);
    expect(isStaleWrite("2026-11-11T10:00:00.000Z", null)).toBe(false);
    expect(isStaleWrite("n'importe quoi", "2026-11-11T10:00:00.000Z")).toBe(false);
  });
});

describe("writeConflicts", () => {
  it("compte chaque ligne une fois et prévient la bannière", () => {
    const seen: number[] = [];
    const off = subscribeToWriteConflicts((n) => seen.push(n));
    noteWriteConflict("training_sessions", "s1");
    noteWriteConflict("training_sessions", "s1");
    noteWriteConflict("appointments", "a1");
    clearWriteConflicts();
    off();
    expect(seen).toEqual([0, 1, 2, 0]);
    expect(writeConflictCount()).toBe(0);
  });
});
