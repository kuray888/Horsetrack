import { describe, expect, it } from "vitest";
import { amountsForHorses, splitAmount } from "@/agenda/splitAmount";

describe("splitAmount", () => {
  it("divise exactement quand ça tombe juste", () => {
    expect(splitAmount(180, 3)).toEqual([60, 60, 60]);
  });

  it("distribue le reste au centime, sans jamais perdre d'argent", () => {
    const parts = splitAmount(100, 3);
    expect(parts).toEqual([33.34, 33.33, 33.33]);
    expect(parts.reduce((a, b) => a + Math.round(b * 100), 0)).toBe(10000);
  });

  it("garde le total exact sur des montants à centimes", () => {
    for (const [amount, n] of [
      [0.01, 3],
      [12.35, 4],
      [999.99, 7],
      [45.5, 2],
    ] as const) {
      const parts = splitAmount(amount, n);
      expect(parts).toHaveLength(n);
      expect(parts.reduce((a, b) => a + Math.round(b * 100), 0)).toBe(Math.round(amount * 100));
    }
  });

  it("rend le montant tel quel pour un seul cheval", () => {
    expect(splitAmount(42.42, 1)).toEqual([42.42]);
  });

  it("ne rend rien pour zéro part", () => {
    expect(splitAmount(10, 0)).toEqual([]);
  });
});

describe("amountsForHorses", () => {
  it("répète le montant en mode « par cheval »", () => {
    expect(amountsForHorses(180, 3, "per-horse")).toEqual([180, 180, 180]);
  });

  it("répartit en mode « à répartir »", () => {
    expect(amountsForHorses(180, 3, "split")).toEqual([60, 60, 60]);
  });

  it("se comporte pareil sur un seul cheval, quel que soit le mode", () => {
    expect(amountsForHorses(180, 1, "per-horse")).toEqual([180]);
    expect(amountsForHorses(180, 1, "split")).toEqual([180]);
  });
});
