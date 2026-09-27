import { describe, expect, it } from "vitest";
import { ALL_TIPS_FOR_TESTS, dailyTip } from "./dailyTips";

function day(offset: number): Date {
  return new Date(2026, 0, 1 + offset, 12);
}

describe("dailyTip", () => {
  it("reste le même toute la journée", () => {
    expect(dailyTip(new Date(2026, 8, 25, 7))).toBe(dailyTip(new Date(2026, 8, 25, 22)));
  });

  it("ne se répète pas avant d'avoir fait le tour des conseils généraux", () => {
    const seen = new Set(Array.from({ length: ALL_TIPS_FOR_TESTS.GENERAL_TIPS.length }, (_, i) => dailyTip(day(i))));
    expect(seen.size).toBe(ALL_TIPS_FOR_TESTS.GENERAL_TIPS.length);
  });

  it("mêle conseils de la discipline et conseils généraux", () => {
    const tips = Array.from({ length: 14 }, (_, i) => dailyTip(day(i), "DRESSAGE"));
    const dressage = ALL_TIPS_FOR_TESTS.DISCIPLINE_TIPS.DRESSAGE ?? [];
    expect(tips.some((t) => dressage.includes(t))).toBe(true);
    expect(tips.some((t) => ALL_TIPS_FOR_TESTS.GENERAL_TIPS.includes(t))).toBe(true);
  });

  it("n'a aucun doublon", () => {
    const all = [...ALL_TIPS_FOR_TESTS.GENERAL_TIPS, ...Object.values(ALL_TIPS_FOR_TESTS.DISCIPLINE_TIPS).flat()];
    expect(new Set(all).size).toBe(all.length);
  });
});
