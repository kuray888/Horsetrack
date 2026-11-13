import { describe, expect, it } from "vitest";
import { closeReferralNudge, countPositive, initialReferralNudge, shouldShowReferralNudge } from "./referralNudgeLogic";

const day = (n: number) => new Date(Date.UTC(2026, 10, 1 + n, 12));

describe("carte de parrainage", () => {
  const start = initialReferralNudge(day(0));
  const ready = { ...start, positive: 5 };

  it("ni trop tôt, ni sans moments positifs", () => {
    expect(shouldShowReferralNudge(ready, day(9))).toBe(false);
    expect(shouldShowReferralNudge({ ...start, positive: 4 }, day(20))).toBe(false);
    expect(shouldShowReferralNudge(ready, day(10))).toBe(true);
  });

  it("compte les moments positifs", () => {
    expect(countPositive(countPositive(start)).positive).toBe(2);
  });

  it("30 jours de silence après une fermeture ou une ouverture", () => {
    const closed = closeReferralNudge(ready, day(10), "dismissed");
    expect(shouldShowReferralNudge(closed, day(39))).toBe(false);
    expect(shouldShowReferralNudge(closed, day(40))).toBe(true);
    const opened = closeReferralNudge(ready, day(10), "opened");
    expect(shouldShowReferralNudge(opened, day(39))).toBe(false);
  });

  it("plus jamais après deux fermetures", () => {
    const twice = closeReferralNudge(closeReferralNudge(ready, day(10), "dismissed"), day(40), "dismissed");
    expect(shouldShowReferralNudge(twice, day(400))).toBe(false);
  });

  it("4 fois par an au plus", () => {
    let s = ready;
    for (const d of [10, 40, 70, 100]) s = closeReferralNudge(s, day(d), "opened");
    expect(shouldShowReferralNudge(s, day(140))).toBe(false);
    expect(shouldShowReferralNudge(s, day(380))).toBe(true);
  });
});
