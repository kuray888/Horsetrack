import { describe, it, expect } from "vitest";
import { initialReviewState, registerPositiveMoment, shouldRequestReview } from "./reviewPromptLogic";

const day = (n: number) => new Date(2026, 0, 1 + n, 12);

describe("demande d'avis", () => {
  it("n'arrive jamais la première semaine", () => {
    let state = initialReviewState(day(0));
    for (let i = 0; i < 5; i++) {
      const r = registerPositiveMoment(state, day(2));
      state = r.state;
      expect(r.ask).toBe(false);
    }
  });

  it("arrive au 3ᵉ moment positif après 7 jours, puis remet le compteur à zéro", () => {
    let state = initialReviewState(day(0));
    state = registerPositiveMoment(state, day(8)).state;
    state = registerPositiveMoment(state, day(9)).state;
    const r = registerPositiveMoment(state, day(10));
    expect(r.ask).toBe(true);
    expect(r.state.positiveSinceLastRequest).toBe(0);
    expect(r.state.requestedAt).toHaveLength(1);
  });

  it("attend 120 jours entre deux demandes", () => {
    const state = { firstSeenAt: day(0).toISOString(), positiveSinceLastRequest: 5, requestedAt: [day(10).toISOString()] };
    expect(shouldRequestReview(state, day(100))).toBe(false);
    expect(shouldRequestReview(state, day(131))).toBe(true);
  });

  it("ne dépasse pas 3 demandes sur 12 mois", () => {
    const state = {
      firstSeenAt: day(0).toISOString(),
      positiveSinceLastRequest: 5,
      requestedAt: [day(-300).toISOString(), day(-170).toISOString(), day(-130).toISOString()],
    };
    expect(shouldRequestReview(state, day(0))).toBe(false);
  });
});
