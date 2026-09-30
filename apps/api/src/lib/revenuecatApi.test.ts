import { describe, expect, it } from "vitest";
import { entitlementStateFromSubscriber } from "./revenuecatApi";

const NOW = Date.UTC(2026, 8, 30);
const future = new Date(NOW + 20 * 86_400_000).toISOString();
const past = new Date(NOW - 86_400_000).toISOString();

describe("entitlementStateFromSubscriber", () => {
  it("reconnaît un octroi promotionnel à vie", () => {
    expect(
      entitlementStateFromSubscriber(
        {
          subscriber: {
            entitlements: { grand_prix: { expires_date: null, product_identifier: "rc_promo_grand_prix_lifetime" } },
            subscriptions: {},
          },
        },
        NOW
      )
    ).toEqual({
      active: true,
      grant: { subscriptionTier: "GRAND_PRIX", subscriptionStatus: "ACTIVE", billingPeriod: null, trialEndsAt: null },
    });
  });

  it("reconnaît un essai store avec sa date de fin", () => {
    expect(
      entitlementStateFromSubscriber(
        {
          subscriber: {
            entitlements: { grand_prix: { expires_date: future, product_identifier: "premium_annual" } },
            subscriptions: { premium_annual: { period_type: "trial", store: "app_store" } },
          },
        },
        NOW
      )
    ).toEqual({
      active: true,
      grant: { subscriptionTier: "GRAND_PRIX", subscriptionStatus: "TRIALING", billingPeriod: "ANNUAL", trialEndsAt: new Date(future) },
    });
  });

  it("garde l'accès pendant la période de grâce d'un échec de paiement", () => {
    const state = entitlementStateFromSubscriber(
      {
        subscriber: {
          entitlements: { grand_prix: { expires_date: past, grace_period_expires_date: future, product_identifier: "premium_monthly" } },
          subscriptions: { premium_monthly: { period_type: "normal", store: "app_store" } },
        },
      },
      NOW
    );
    expect(state).toMatchObject({ active: true, grant: { subscriptionStatus: "ACTIVE", billingPeriod: "MONTHLY" } });
  });

  it("aucun accès : entitlement absent ou expiré", () => {
    expect(entitlementStateFromSubscriber({ subscriber: { entitlements: {} } }, NOW)).toEqual({ active: false });
    expect(
      entitlementStateFromSubscriber(
        { subscriber: { entitlements: { grand_prix: { expires_date: past, product_identifier: "premium_monthly" } } } },
        NOW
      )
    ).toEqual({ active: false });
  });
});
