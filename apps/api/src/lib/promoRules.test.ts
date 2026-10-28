import { describe, expect, it } from "vitest";
import {
  checkPromoAvailability,
  describeDiscount,
  isPremiumNow,
  normalizePromoCode,
  parisDayBoundary,
  pickWinbackOffer,
  storeRedeemUrl,
  type PromoForRules,
  type RiderForRules,
  type WinbackCandidate,
} from "./promoRules";

const NOW = new Date("2026-10-26T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

const promo = (over: Partial<PromoForRules> = {}): PromoForRules => ({
  active: true,
  startsAt: null,
  expiresAt: null,
  eligibility: "ANYONE",
  maxAccountAgeDays: null,
  ...over,
});

const rider = (over: Partial<RiderForRules> = {}): RiderForRules => ({
  subscriptionStatus: "EXPIRED",
  trialEndsAt: null,
  revenuecatId: null,
  createdAt: new Date(NOW.getTime() - 10 * DAY),
  ...over,
});

describe("checkPromoAvailability", () => {
  it("accepte un code actif sans condition", () => {
    expect(checkPromoAvailability(promo(), rider(), NOW)).toEqual({ ok: true });
  });

  it("refuse un code désactivé", () => {
    expect(checkPromoAvailability(promo({ active: false }), rider(), NOW)).toMatchObject({ ok: false, status: 404 });
  });

  it("refuse un code pas encore valable, en donnant la date", () => {
    const r = checkPromoAvailability(promo({ startsAt: new Date("2026-11-01T00:00:00Z") }), rider(), NOW);
    expect(r).toMatchObject({ ok: false, status: 403 });
    expect(r.ok === false && r.error).toContain("1er novembre 2026");
  });

  it("refuse un code expiré", () => {
    expect(checkPromoAvailability(promo({ expiresAt: new Date(NOW.getTime() - 1) }), rider(), NOW)).toMatchObject({
      ok: false,
      status: 410,
    });
  });

  it("limite aux comptes récents", () => {
    const p = promo({ maxAccountAgeDays: 7 });
    expect(checkPromoAvailability(p, rider(), NOW).ok).toBe(false);
    expect(checkPromoAvailability(p, rider({ createdAt: new Date(NOW.getTime() - 3 * DAY) }), NOW).ok).toBe(true);
  });

  it("réserve NEVER_SUBSCRIBED aux comptes sans abonnement store passé", () => {
    const p = promo({ eligibility: "NEVER_SUBSCRIBED" });
    expect(checkPromoAvailability(p, rider(), NOW).ok).toBe(true);
    expect(checkPromoAvailability(p, rider({ revenuecatId: "u1" }), NOW).ok).toBe(false);
  });

  it("réserve LAPSED_SUBSCRIBERS aux anciens abonnés qui ne sont plus Premium", () => {
    const p = promo({ eligibility: "LAPSED_SUBSCRIBERS" });
    expect(checkPromoAvailability(p, rider(), NOW).ok).toBe(false);
    expect(checkPromoAvailability(p, rider({ revenuecatId: "u1" }), NOW).ok).toBe(true);
    expect(checkPromoAvailability(p, rider({ revenuecatId: "u1", subscriptionStatus: "ACTIVE" }), NOW).ok).toBe(false);
  });
});

describe("isPremiumNow", () => {
  it("compte un essai seulement tant qu'il court", () => {
    expect(isPremiumNow({ subscriptionStatus: "TRIALING", trialEndsAt: new Date(NOW.getTime() + DAY) }, NOW)).toBe(true);
    expect(isPremiumNow({ subscriptionStatus: "TRIALING", trialEndsAt: new Date(NOW.getTime() - DAY) }, NOW)).toBe(false);
    expect(isPremiumNow({ subscriptionStatus: "TRIALING", trialEndsAt: null }, NOW)).toBe(false);
    expect(isPremiumNow({ subscriptionStatus: "ACTIVE", trialEndsAt: null }, NOW)).toBe(true);
  });
});

describe("helpers", () => {
  it("normalise la saisie", () => {
    expect(normalizePromoCode(" equi ta 26 ")).toBe("EQUITA26");
  });

  it("construit les adresses officielles de rédemption", () => {
    expect(storeRedeemUrl("ios", "RENTREE30", "6786889092")).toBe(
      "https://apps.apple.com/redeem?ctx=offercodes&id=6786889092&code=RENTREE30"
    );
    expect(storeRedeemUrl("android", "A B", "x")).toBe("https://play.google.com/redeem?code=A%20B");
  });

  it("décrit la remise", () => {
    expect(describeDiscount("PERCENT", 30)).toBe("−30 %");
    expect(describeDiscount("AMOUNT", 1000)).toBe("−10,00 €");
    expect(describeDiscount("FREE_PERIOD", 3)).toBe("3 mois offerts");
    expect(describeDiscount(null, 3)).toBeNull();
  });
});

describe("parisDayBoundary", () => {
  it("convertit un jour en minuit heure de Paris (hiver et été)", () => {
    expect(parisDayBoundary("2026-12-01")?.toISOString()).toBe("2026-11-30T23:00:00.000Z");
    expect(parisDayBoundary("2026-07-01")?.toISOString()).toBe("2026-06-30T22:00:00.000Z");
    expect(parisDayBoundary("2026-12-01", true)?.toISOString()).toBe("2026-12-01T22:59:59.000Z");
  });

  it("rejette une saisie invalide", () => {
    expect(parisDayBoundary("")).toBeNull();
    expect(parisDayBoundary("2026-02-30")).toBeNull();
    expect(parisDayBoundary("01/12/2026")).toBeNull();
  });
});

describe("pickWinbackOffer", () => {
  const lapsed: RiderForRules = {
    subscriptionStatus: "EXPIRED",
    trialEndsAt: new Date(NOW.getTime() - 3 * DAY),
    revenuecatId: "rc_1",
    createdAt: new Date(NOW.getTime() - 40 * DAY),
  };
  const offer = (over: Partial<WinbackCandidate> = {}): WinbackCandidate => ({
    id: "p1",
    code: "RETOUR50",
    kind: "STORE_OFFER",
    campaign: "retour",
    active: true,
    startsAt: null,
    expiresAt: null,
    eligibility: "LAPSED_SUBSCRIBERS",
    maxAccountAgeDays: null,
    maxRedemptions: null,
    redemptionCount: 0,
    ownRedemptionStatus: null,
    ...over,
  });

  it("propose l'offre de retour à un ancien abonné", () => {
    expect(pickWinbackOffer([offer()], lapsed, NOW)?.code).toBe("RETOUR50");
  });

  it("ne propose rien à un compte Premium", () => {
    expect(pickWinbackOffer([offer()], { ...lapsed, subscriptionStatus: "ACTIVE" }, NOW)).toBeNull();
  });

  it("ignore les codes hors campagne, les jours Premium et les offres épuisées ou déjà utilisées", () => {
    expect(pickWinbackOffer([offer({ campaign: "salon" })], lapsed, NOW)).toBeNull();
    expect(pickWinbackOffer([offer({ kind: "PREMIUM_DAYS" })], lapsed, NOW)).toBeNull();
    expect(pickWinbackOffer([offer({ maxRedemptions: 5, redemptionCount: 5 })], lapsed, NOW)).toBeNull();
    expect(pickWinbackOffer([offer({ ownRedemptionStatus: "CONVERTED" })], lapsed, NOW)).toBeNull();
    expect(pickWinbackOffer([offer({ active: false })], lapsed, NOW)).toBeNull();
  });

  it("garde une offre ouverte puis abandonnée sur la feuille Apple, même si le plafond est atteint", () => {
    expect(
      pickWinbackOffer([offer({ ownRedemptionStatus: "STORE_REDIRECTED", maxRedemptions: 1, redemptionCount: 1 })], lapsed, NOW)
    ).not.toBeNull();
  });

  it("respecte l'éligibilité (un compte jamais abonné n'est pas « ancien abonné »)", () => {
    expect(pickWinbackOffer([offer()], { ...lapsed, revenuecatId: null }, NOW)).toBeNull();
  });

  it("choisit l'offre qui expire le plus tôt", () => {
    const later = offer({ id: "a", code: "LATER", expiresAt: new Date(NOW.getTime() + 20 * DAY) });
    const sooner = offer({ id: "b", code: "SOONER", expiresAt: new Date(NOW.getTime() + 5 * DAY) });
    expect(pickWinbackOffer([later, sooner], lapsed, NOW)?.code).toBe("SOONER");
  });
});
