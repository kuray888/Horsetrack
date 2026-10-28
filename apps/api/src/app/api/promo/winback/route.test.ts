import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  riderProfile: { findUnique: vi.fn() },
  promoCode: { findMany: vi.fn() },
}));
const auth = vi.hoisted(() => ({ getUserIdFromRequest: vi.fn(async (): Promise<string | null> => "user-1") }));

vi.mock("@cheval/db", () => ({ db, PromoKind: { PREMIUM_DAYS: "PREMIUM_DAYS", STORE_OFFER: "STORE_OFFER" } }));
vi.mock("@/lib/supabaseAdmin", () => auth);

import { GET } from "./route";

const DAY = 24 * 60 * 60 * 1000;
const call = () => GET(new NextRequest("https://api.test/api/promo/winback", { headers: { authorization: "Bearer t" } }));

const winback = {
  id: "p1",
  code: "RETOUR50",
  kind: "STORE_OFFER",
  campaign: "retour",
  description: "50 % sur ta première année",
  discountType: "PERCENT",
  discountValue: 50,
  active: true,
  startsAt: null,
  expiresAt: null,
  eligibility: "LAPSED_SUBSCRIBERS",
  maxAccountAgeDays: null,
  maxRedemptions: null,
  _count: { redemptions: 0 },
  redemptions: [] as { status: string }[],
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.getUserIdFromRequest.mockResolvedValue("user-1");
  db.riderProfile.findUnique.mockResolvedValue({
    id: "rp1",
    subscriptionStatus: "EXPIRED",
    trialEndsAt: new Date(Date.now() - 2 * DAY),
    revenuecatId: "rc_1",
    createdAt: new Date(Date.now() - 30 * DAY),
  });
  db.promoCode.findMany.mockResolvedValue([winback]);
});

describe("GET /api/promo/winback", () => {
  it("refuse un appel non authentifié", async () => {
    auth.getUserIdFromRequest.mockResolvedValueOnce(null);
    expect((await call()).status).toBe(401);
  });

  it("renvoie l'offre de retour d'un ancien abonné, sans prix calculé", async () => {
    const res = await call();
    expect(await res.json()).toEqual({
      offer: { code: "RETOUR50", headline: "−50 %", description: "50 % sur ta première année", expiresAt: null },
    });
  });

  it("ne renvoie rien à un abonné actif", async () => {
    db.riderProfile.findUnique.mockResolvedValueOnce({
      id: "rp1",
      subscriptionStatus: "ACTIVE",
      trialEndsAt: null,
      revenuecatId: "rc_1",
      createdAt: new Date(),
    });
    expect(await (await call()).json()).toEqual({ offer: null });
  });

  it("ne renvoie rien si l'offre a déjà servi à ce compte", async () => {
    db.promoCode.findMany.mockResolvedValueOnce([{ ...winback, redemptions: [{ status: "CONVERTED" }] }]);
    expect(await (await call()).json()).toEqual({ offer: null });
  });
});
