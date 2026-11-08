import { describe, expect, it } from "vitest";
import { initialNudgeState, recordNudgeShown, recordPaywallSeen, shouldShowNudge } from "./premiumNudgeLogic";

const DAY = 24 * 60 * 60 * 1000;
const start = new Date("2026-11-01T10:00:00Z");
const at = (days: number) => new Date(start.getTime() + days * DAY);
const free = (now: Date, activityCount = 5) => ({ premium: false, activityCount, now });

describe("shouldShowNudge", () => {
  const fresh = initialNudgeState(start);

  it("attend 3 jours d'usage", () => {
    expect(shouldShowNudge(fresh, free(at(2.9)))).toBe(false);
    expect(shouldShowNudge(fresh, free(at(3)))).toBe(true);
  });

  it("attend de vraies traces d'usage", () => {
    expect(shouldShowNudge(fresh, free(at(10), 2))).toBe(false);
    expect(shouldShowNudge(fresh, free(at(10), 3))).toBe(true);
  });

  it("jamais pour un compte Premium (abonné, essai, offert)", () => {
    expect(shouldShowNudge(fresh, { premium: true, activityCount: 50, now: at(30) })).toBe(false);
  });

  it("se fait de plus en plus rare : 7, 14, puis 30 jours", () => {
    let s = recordNudgeShown(fresh, at(3));
    expect(shouldShowNudge(s, free(at(9.9)))).toBe(false);
    expect(shouldShowNudge(s, free(at(10)))).toBe(true);
    s = recordNudgeShown(s, at(10));
    expect(shouldShowNudge(s, free(at(23.9)))).toBe(false);
    expect(shouldShowNudge(s, free(at(24)))).toBe(true);
    s = recordNudgeShown(s, at(24));
    expect(shouldShowNudge(s, free(at(53.9)))).toBe(false);
    expect(shouldShowNudge(s, free(at(54)))).toBe(true);
    // Au-delà, une fois par mois, même après de nombreuses relances.
    let last = 54;
    for (let d = 54; d <= 300; d += 30) {
      s = recordNudgeShown(s, at(d));
      last = d;
    }
    expect(s.shownAt.length).toBe(5);
    expect(shouldShowNudge(s, free(at(last + 29)))).toBe(false);
    expect(shouldShowNudge(s, free(at(last + 30)))).toBe(true);
  });

  it("se tait 3 jours après n'importe quel paywall vu", () => {
    const s = recordPaywallSeen(fresh, at(5));
    expect(shouldShowNudge(s, free(at(7.9)))).toBe(false);
    expect(shouldShowNudge(s, free(at(8)))).toBe(true);
  });
});
