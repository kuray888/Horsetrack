import { describe, expect, it } from "vitest";
import { FREE_TIER_V2_SINCE, canAddGoal, historyCutoff, isFreeTierRestricted, splitHistory } from "./freeTier";

const before = new Date(FREE_TIER_V2_SINCE.getTime() - 1000);
const after = new Date(FREE_TIER_V2_SINCE.getTime() + 1000);

describe("isFreeTierRestricted", () => {
  it("ne touche jamais un compte créé avant la date", () => {
    expect(isFreeTierRestricted(false, before)).toBe(false);
  });
  it("vise un compte gratuit créé après la date", () => {
    expect(isFreeTierRestricted(false, after)).toBe(true);
  });
  it("jamais Premium (actif, essai, offert)", () => {
    expect(isFreeTierRestricted(true, after)).toBe(false);
  });
  it("date inconnue ou invalide : pas de restriction", () => {
    expect(isFreeTierRestricted(false, null)).toBe(false);
    expect(isFreeTierRestricted(false, new Date("x"))).toBe(false);
  });
});

describe("historyCutoff / splitHistory", () => {
  const now = new Date(2027, 2, 31, 15, 0);
  it("sans restriction, tout est affiché", () => {
    expect(historyCutoff(false, now)).toBeNull();
    expect(splitHistory([{ d: new Date(2020, 0, 1) }], (x) => x.d, null)).toEqual({ visible: [{ d: new Date(2020, 0, 1) }], hiddenCount: 0 });
  });
  it("garde 90 jours, à partir de minuit", () => {
    const cutoff = historyCutoff(true, now)!;
    expect(cutoff).toEqual(new Date(2026, 11, 31));
    const items = [new Date(2026, 11, 31, 8), new Date(2026, 11, 30, 23), new Date(2027, 2, 1)];
    const { visible, hiddenCount } = splitHistory(items, (d) => d, cutoff);
    expect(visible).toEqual([new Date(2026, 11, 31, 8), new Date(2027, 2, 1)]);
    expect(hiddenCount).toBe(1);
  });
});

describe("canAddGoal", () => {
  it("un objectif à la fois pour un compte restreint", () => {
    expect(canAddGoal(true, 0)).toBe(true);
    expect(canAddGoal(true, 1)).toBe(false);
  });
  it("illimité sinon", () => {
    expect(canAddGoal(false, 5)).toBe(true);
  });
});
