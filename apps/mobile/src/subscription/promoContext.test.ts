import { beforeEach, describe, expect, it } from "vitest";
import {
  getPromoContext,
  notePromoCodeResult,
  noteWinbackOfferShown,
  promoAnalyticsProps,
  resetPromoContextForTests,
} from "@/subscription/promoContext";

describe("contexte promo des événements du paywall", () => {
  beforeEach(resetPromoContextForTests);

  it("sans code ni offre", () => {
    expect(promoAnalyticsProps(getPromoContext())).toEqual({
      promo_code_state: "none",
      promo_code: null,
      promo_code_kind: null,
      winback_offer: false,
    });
  });

  it("un code accepté est joint, normalisé", () => {
    notePromoCodeResult(" salon26 ", "store_offer");
    expect(promoAnalyticsProps(getPromoContext())).toMatchObject({
      promo_code_state: "valid",
      promo_code: "SALON26",
      promo_code_kind: "store_offer",
    });
  });

  it("un code refusé n'est jamais joint", () => {
    notePromoCodeResult("n'importe quoi", "invalid");
    expect(promoAnalyticsProps(getPromoContext())).toMatchObject({ promo_code_state: "invalid", promo_code: null });
  });

  it("le dernier code saisi l'emporte, l'offre de retour reste notée", () => {
    noteWinbackOfferShown("RETOUR");
    notePromoCodeResult("AAA", "applied");
    notePromoCodeResult("BBB", "invalid");
    expect(promoAnalyticsProps(getPromoContext())).toMatchObject({ promo_code_state: "invalid", winback_offer: true });
  });
});
