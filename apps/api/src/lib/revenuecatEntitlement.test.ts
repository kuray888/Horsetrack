import { describe, expect, it } from "vitest";
import { grantFieldsForEvent, isPromotionalEvent } from "./revenuecatEntitlement";

describe("grantFieldsForEvent", () => {
  it("active un octroi promotionnel du dashboard (NON_RENEWING_PURCHASE)", () => {
    // Forme réelle d'un octroi « Premium offert » envoyé par RevenueCat.
    expect(
      grantFieldsForEvent({
        type: "NON_RENEWING_PURCHASE",
        store: "PROMOTIONAL",
        period_type: "PROMOTIONAL",
        product_id: "rc_promo_grand_prix_lifetime",
        expiration_at_ms: null,
      })
    ).toEqual({ subscriptionTier: "GRAND_PRIX", subscriptionStatus: "ACTIVE", billingPeriod: null, trialEndsAt: null });
  });

  it("un octroi promotionnel n'est jamais un essai, même limité dans le temps", () => {
    const fields = grantFieldsForEvent({
      type: "NON_RENEWING_PURCHASE",
      store: "PROMOTIONAL",
      period_type: "PROMOTIONAL",
      product_id: "rc_promo_grand_prix_monthly",
      expiration_at_ms: Date.now() + 30 * 86_400_000,
    });
    expect(fields?.subscriptionStatus).toBe("ACTIVE");
    // « monthly » dans le SKU promo ne doit pas faire croire à un abonnement store.
    expect(fields?.billingPeriod).toBeNull();
  });

  it("garde le comportement d'un achat store : essai puis abonnement", () => {
    const end = Date.UTC(2026, 10, 1);
    expect(
      grantFieldsForEvent({ type: "INITIAL_PURCHASE", period_type: "TRIAL", store: "APP_STORE", product_id: "premium_annual", expiration_at_ms: end })
    ).toEqual({ subscriptionTier: "GRAND_PRIX", subscriptionStatus: "TRIALING", billingPeriod: "ANNUAL", trialEndsAt: new Date(end) });
    expect(
      grantFieldsForEvent({ type: "RENEWAL", period_type: "NORMAL", store: "APP_STORE", product_id: "premium_monthly" })
    ).toEqual({ subscriptionTier: "GRAND_PRIX", subscriptionStatus: "ACTIVE", billingPeriod: "MONTHLY", trialEndsAt: null });
  });

  it("n'ouvre rien pour les événements qui ne donnent pas accès", () => {
    for (const type of ["CANCELLATION", "EXPIRATION", "BILLING_ISSUE", "TRANSFER", undefined]) {
      expect(grantFieldsForEvent({ type, store: "PROMOTIONAL" })).toBeNull();
    }
  });
});

describe("isPromotionalEvent", () => {
  it("reconnaît l'octroi par le store ou par la période", () => {
    expect(isPromotionalEvent({ store: "PROMOTIONAL" })).toBe(true);
    expect(isPromotionalEvent({ period_type: "PROMOTIONAL" })).toBe(true);
    expect(isPromotionalEvent({ store: "APP_STORE", period_type: "NORMAL" })).toBe(false);
  });
});
