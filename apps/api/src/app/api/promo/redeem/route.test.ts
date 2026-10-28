import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const tx = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  promoCodeRedemption: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
}));
const db = vi.hoisted(() => ({
  riderProfile: { findUnique: vi.fn(), update: vi.fn() },
  promoCode: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@cheval/db", () => ({
  db,
  PromoKind: { PREMIUM_DAYS: "PREMIUM_DAYS", STORE_OFFER: "STORE_OFFER" },
  PromoRedemptionStatus: {
    APPLIED: "APPLIED",
    ALREADY_PREMIUM: "ALREADY_PREMIUM",
    STORE_REDIRECTED: "STORE_REDIRECTED",
    CONVERTED: "CONVERTED",
  },
  SubscriptionStatus: { ACTIVE: "ACTIVE", TRIALING: "TRIALING", EXPIRED: "EXPIRED", CANCELLED: "CANCELLED" },
}));
vi.mock("@/lib/supabaseAdmin", () => ({ getUserIdFromRequest: vi.fn(async () => "user-1") }));

import { POST } from "./route";

const DAY = 24 * 60 * 60 * 1000;

function call(body: Record<string, unknown>) {
  return POST(
    new NextRequest("https://api.test/api/promo/redeem", {
      method: "POST",
      headers: { authorization: "Bearer t", "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

const basePromo = {
  id: "p1",
  code: "EQUITA",
  description: null,
  kind: "PREMIUM_DAYS",
  premiumDays: 30,
  storeOfferCode: null,
  active: true,
  startsAt: null,
  expiresAt: null,
  maxRedemptions: null,
  eligibility: "ANYONE",
  maxAccountAgeDays: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  db.riderProfile.findUnique.mockResolvedValue({
    id: "rp1",
    subscriptionStatus: "EXPIRED",
    trialEndsAt: null,
    revenuecatId: null,
    createdAt: new Date(Date.now() - 5 * DAY),
  });
  db.promoCode.findUnique.mockResolvedValue(basePromo);
  db.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
  tx.promoCodeRedemption.findFirst.mockResolvedValue(null);
  tx.promoCodeRedemption.count.mockResolvedValue(0);
});

describe("POST /api/promo/redeem", () => {
  it("accorde les jours Premium d'un code classique (normalisé)", async () => {
    const res = await call({ code: " equi ta " });
    const json = await res.json();
    expect(db.promoCode.findUnique).toHaveBeenCalledWith({ where: { code: "EQUITA" } });
    expect(json.applied).toBe(true);
    expect(tx.promoCodeRedemption.create).toHaveBeenCalledWith({
      data: { promoCodeId: "p1", riderId: "rp1", status: "APPLIED" },
    });
    expect(db.riderProfile.update).toHaveBeenCalledOnce();
  });

  it("signale un code inconnu pour proposer la saisie dans l'App Store", async () => {
    db.promoCode.findUnique.mockResolvedValue(null);
    const res = await call({ code: "ABC" });
    expect(res.status).toBe(404);
    expect((await res.json()).unknown).toBe(true);
  });

  it("refuse un code hors conditions sans rien enregistrer", async () => {
    db.promoCode.findUnique.mockResolvedValue({ ...basePromo, eligibility: "LAPSED_SUBSCRIBERS" });
    const res = await call({ code: "EQUITA" });
    expect(res.status).toBe(403);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuse une seconde utilisation par le même compte", async () => {
    tx.promoCodeRedemption.findFirst.mockResolvedValue({ status: "APPLIED" });
    const res = await call({ code: "EQUITA" });
    expect(res.status).toBe(409);
  });

  it("respecte la limite d'utilisations", async () => {
    db.promoCode.findUnique.mockResolvedValue({ ...basePromo, maxRedemptions: 2 });
    tx.promoCodeRedemption.count.mockResolvedValue(2);
    const res = await call({ code: "EQUITA" });
    expect(res.status).toBe(410);
    expect(tx.promoCodeRedemption.create).not.toHaveBeenCalled();
  });

  it("n'écrase jamais un abonnement payant", async () => {
    db.riderProfile.findUnique.mockResolvedValue({
      id: "rp1",
      subscriptionStatus: "ACTIVE",
      trialEndsAt: null,
      revenuecatId: "user-1",
      createdAt: new Date(),
    });
    const json = await (await call({ code: "EQUITA" })).json();
    expect(json.applied).toBe(false);
    expect(db.riderProfile.update).not.toHaveBeenCalled();
    expect(tx.promoCodeRedemption.create).toHaveBeenCalledWith({
      data: { promoCodeId: "p1", riderId: "rp1", status: "ALREADY_PREMIUM" },
    });
  });

  describe("offre store", () => {
    const storePromo = { ...basePromo, kind: "STORE_OFFER", premiumDays: 0, storeOfferCode: "RENTREE30APPLE" };

    beforeEach(() => db.promoCode.findUnique.mockResolvedValue(storePromo));

    it("renvoie l'adresse Apple avec le code d'offre, sans toucher à l'abonnement", async () => {
      const json = await (await call({ code: "EQUITA", platform: "ios" })).json();
      expect(json.kind).toBe("store_offer");
      expect(json.applied).toBe(false);
      expect(json.redeemUrl).toBe("https://apps.apple.com/redeem?ctx=offercodes&id=6786889092&code=RENTREE30APPLE");
      expect(db.riderProfile.update).not.toHaveBeenCalled();
      expect(tx.promoCodeRedemption.create).toHaveBeenCalledWith({
        data: { promoCodeId: "p1", riderId: "rp1", status: "STORE_REDIRECTED" },
      });
    });

    it("rouvre l'offre abandonnée sans consommer de nouvelle place", async () => {
      tx.promoCodeRedemption.findFirst.mockResolvedValue({ status: "STORE_REDIRECTED" });
      const json = await (await call({ code: "EQUITA" })).json();
      expect(json.redeemUrl).toContain("apps.apple.com/redeem");
      expect(tx.promoCodeRedemption.create).not.toHaveBeenCalled();
      expect(tx.promoCodeRedemption.count).not.toHaveBeenCalled();
    });

    it("refuse une offre déjà convertie", async () => {
      tx.promoCodeRedemption.findFirst.mockResolvedValue({ status: "CONVERTED" });
      expect((await call({ code: "EQUITA" })).status).toBe(409);
    });

    it("utilise Google Play sur Android", async () => {
      const json = await (await call({ code: "EQUITA", platform: "android" })).json();
      expect(json.redeemUrl).toBe("https://play.google.com/redeem?code=RENTREE30APPLE");
    });
  });
});
