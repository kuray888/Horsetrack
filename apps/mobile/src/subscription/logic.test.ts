import { describe, it, expect } from "vitest";
import { computeIsActiveOrTrialing, maxHorses, FREE_HORSE_LIMIT, PREMIUM_HORSE_LIMIT } from "./logic";

describe("computeIsActiveOrTrialing", () => {
  it("est actif pour un abonnement payant", () => {
    expect(computeIsActiveOrTrialing({ status: "active", trialEndsAt: null })).toBe(true);
  });

  it("est actif pendant un essai dont la date de fin n'est pas encore atteinte", () => {
    const trialEndsAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    expect(computeIsActiveOrTrialing({ status: "trialing", trialEndsAt })).toBe(true);
  });

  it("n'est plus actif une fois l'essai expiré", () => {
    const trialEndsAt = new Date(Date.now() - 1000).toISOString();
    expect(computeIsActiveOrTrialing({ status: "trialing", trialEndsAt })).toBe(false);
  });

  it("n'est jamais actif si l'essai n'a pas de date de fin (défaut fail-closed)", () => {
    expect(computeIsActiveOrTrialing({ status: "trialing", trialEndsAt: null })).toBe(false);
  });

  it("n'est pas actif pour free/expired/cancelled", () => {
    expect(computeIsActiveOrTrialing({ status: "free", trialEndsAt: null })).toBe(false);
    expect(computeIsActiveOrTrialing({ status: "expired", trialEndsAt: null })).toBe(false);
    expect(computeIsActiveOrTrialing({ status: "cancelled", trialEndsAt: null })).toBe(false);
  });
});

describe("maxHorses", () => {
  it("limite à 1 cheval en gratuit (jamais abonné)", () => {
    expect(maxHorses({ status: "free", trialEndsAt: null, extraHorseSlots: 0 })).toBe(FREE_HORSE_LIMIT);
  });

  it("limite à 1 cheval une fois l'abonnement expiré", () => {
    expect(maxHorses({ status: "expired", trialEndsAt: null, extraHorseSlots: 0 })).toBe(FREE_HORSE_LIMIT);
  });

  it("monte à la limite Premium pour un compte actif", () => {
    expect(maxHorses({ status: "active", trialEndsAt: null, extraHorseSlots: 0 })).toBe(PREMIUM_HORSE_LIMIT);
  });

  it("monte à la limite Premium pendant un essai valide", () => {
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(maxHorses({ status: "trialing", trialEndsAt, extraHorseSlots: 0 })).toBe(PREMIUM_HORSE_LIMIT);
  });

  it("ajoute les slots achetés en add-on, gratuit comme Premium", () => {
    expect(maxHorses({ status: "free", trialEndsAt: null, extraHorseSlots: 1 })).toBe(FREE_HORSE_LIMIT + 1);
    expect(maxHorses({ status: "active", trialEndsAt: null, extraHorseSlots: 1 })).toBe(PREMIUM_HORSE_LIMIT + 1);
  });
});
