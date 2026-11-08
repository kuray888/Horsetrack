import { describe, expect, it } from "vitest";
import { canRetrySummary, isFinishedMonth } from "@/lib/coach/summaryRules";

describe("isFinishedMonth", () => {
  it("accepte le mois écoulé le 1er à 0 h 30 heure de Paris (veille en UTC)", () => {
    expect(isFinishedMonth("2026-10", new Date("2026-10-31T23:30:00Z"))).toBe(true);
  });

  it("refuse le mois en cours au milieu du mois", () => {
    expect(isFinishedMonth("2026-10", new Date("2026-10-15T12:00:00Z"))).toBe(false);
    expect(isFinishedMonth("2026-11", new Date("2026-10-31T23:30:00Z"))).toBe(false);
  });

  it("accepte les mois passés", () => {
    expect(isFinishedMonth("2026-09", new Date("2026-10-15T12:00:00Z"))).toBe(true);
  });
});

describe("canRetrySummary", () => {
  const now = new Date("2026-10-30T12:00:00Z");

  it("relance un échec de plus de 24 h", () => {
    expect(canRetrySummary({ status: "FAILED", updatedAt: new Date("2026-10-29T11:00:00Z") }, now)).toBe(true);
  });

  it("attend 24 h entre deux essais", () => {
    expect(canRetrySummary({ status: "FAILED", updatedAt: new Date("2026-10-30T08:00:00Z") }, now)).toBe(false);
  });

  it("ne relance jamais un résumé réussi ou en cours", () => {
    expect(canRetrySummary({ status: "DONE", updatedAt: new Date("2026-09-01T00:00:00Z") }, now)).toBe(false);
    expect(canRetrySummary({ status: "PENDING", updatedAt: new Date("2026-09-01T00:00:00Z") }, now)).toBe(false);
  });
});
