import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  riderProfile: { findUnique: vi.fn(), updateMany: vi.fn() },
  revenueCatWebhookEvent: { create: vi.fn() },
}));

vi.mock("@cheval/db", () => ({
  db,
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  SubscriptionStatus: { ACTIVE: "ACTIVE", TRIALING: "TRIALING", EXPIRED: "EXPIRED", CANCELLED: "CANCELLED" },
  SubscriptionTier: { FREE: "FREE", GRAND_PRIX: "GRAND_PRIX" },
}));
const rcApi = vi.hoisted(() => ({
  fetchEntitlementState: vi.fn(),
  isRevenueCatApiConfigured: vi.fn(() => true),
}));
vi.mock("@/lib/revenuecatApi", () => ({
  ...rcApi,
  isAnonymousAppUserId: (id: string) => id.startsWith("$RCAnonymousID:"),
}));
vi.mock("@/lib/analytics", () => ({
  analyticsEventForRevenueCat: () => null,
  captureServerEvent: vi.fn(),
}));

import { POST } from "./route";

const SECRET = "test-secret";

function call(event: Record<string, unknown>) {
  return POST(
    new NextRequest("https://api.test/api/revenuecat/webhook", {
      method: "POST",
      headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
      body: JSON.stringify({ event }),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.REVENUECAT_WEBHOOK_SECRET = SECRET;
  db.riderProfile.findUnique.mockResolvedValue({ id: "rp1" });
  db.riderProfile.updateMany.mockResolvedValue({ count: 1 });
  db.revenueCatWebhookEvent.create.mockResolvedValue({});
  rcApi.isRevenueCatApiConfigured.mockReturnValue(true);
});

describe("webhook RevenueCat", () => {
  it("passe en Premium un compte ambassadeur (octroi promotionnel)", async () => {
    const res = await call({
      id: "evt-promo",
      type: "NON_RENEWING_PURCHASE",
      app_user_id: "user-1",
      entitlement_ids: ["grand_prix"],
      store: "PROMOTIONAL",
      period_type: "PROMOTIONAL",
      product_id: "rc_promo_grand_prix_lifetime",
      expiration_at_ms: null,
      event_timestamp_ms: 1_700_000_000_000,
    });
    expect(res.status).toBe(200);
    expect(db.riderProfile.updateMany).toHaveBeenCalledTimes(1);
    expect(db.riderProfile.updateMany.mock.calls[0][0].data).toMatchObject({
      subscriptionTier: "GRAND_PRIX",
      subscriptionStatus: "ACTIVE",
      billingPeriod: null,
      trialEndsAt: null,
    });
  });

  it("fait réessayer RevenueCat quand le profil n'existe pas encore, sans marquer l'événement traité", async () => {
    db.riderProfile.findUnique.mockResolvedValue(null);
    const res = await call({
      id: "evt-onboarding",
      type: "INITIAL_PURCHASE",
      app_user_id: "user-2",
      entitlement_ids: ["grand_prix"],
      period_type: "TRIAL",
      product_id: "premium_annual",
      expiration_at_ms: Date.now() + 86_400_000,
    });
    expect(res.status).toBe(503);
    expect(db.revenueCatWebhookEvent.create).not.toHaveBeenCalled();
    expect(db.riderProfile.updateMany).not.toHaveBeenCalled();
  });

  it("accepte une période inconnue (ex. PREPAID) au lieu de rejeter l'événement", async () => {
    const res = await call({
      id: "evt-prepaid",
      type: "INITIAL_PURCHASE",
      app_user_id: "user-3",
      entitlement_ids: ["grand_prix"],
      period_type: "PREPAID",
      product_id: "premium_monthly",
    });
    expect(res.status).toBe(200);
    expect(db.riderProfile.updateMany.mock.calls[0][0].data).toMatchObject({ subscriptionStatus: "ACTIVE" });
  });

  it("une expiration ne dépend pas de l'existence du profil", async () => {
    db.riderProfile.findUnique.mockResolvedValue(null);
    const res = await call({
      id: "evt-exp",
      type: "EXPIRATION",
      app_user_id: "user-4",
      entitlement_ids: ["grand_prix"],
      store: "PROMOTIONAL",
    });
    expect(res.status).toBe(200);
    expect(db.riderProfile.updateMany.mock.calls[0][0].data).toMatchObject({ subscriptionStatus: "EXPIRED" });
  });

  it("refuse un appel sans le secret", async () => {
    const res = await POST(
      new NextRequest("https://api.test/api/revenuecat/webhook", { method: "POST", body: "{}" })
    );
    expect(res.status).toBe(401);
    expect(db.riderProfile.updateMany).not.toHaveBeenCalled();
  });
});

describe("webhook RevenueCat — TRANSFER", () => {
  const promoGrant = { subscriptionTier: "GRAND_PRIX", subscriptionStatus: "ACTIVE", billingPeriod: null, trialEndsAt: null };

  it("donne l'accès au compte de destination et le retire au compte d'origine", async () => {
    rcApi.fetchEntitlementState.mockImplementation(async (id: string) =>
      id === "nouveau" ? { active: true, grant: promoGrant } : { active: false }
    );
    const res = await call({
      id: "evt-transfer",
      type: "TRANSFER",
      transferred_from: ["ancien", "$RCAnonymousID:abc"],
      transferred_to: ["nouveau"],
    });
    expect(res.status).toBe(200);
    const calls = db.riderProfile.updateMany.mock.calls.map((c) => c[0]);
    expect(calls).toContainEqual(expect.objectContaining({ where: { userId: "nouveau" }, data: expect.objectContaining(promoGrant) }));
    // L'origine n'est rétrogradée que pour un accès venu de RevenueCat, jamais
    // un essai par code promo (cf. applyEntitlementState).
    const origin = calls.find((c) => c.where.userId === "ancien");
    expect(origin?.data).toMatchObject({ subscriptionStatus: "EXPIRED" });
    expect(origin?.where.OR).toBeDefined();
    // Jamais d'appel pour un identifiant anonyme.
    expect(rcApi.fetchEntitlementState).not.toHaveBeenCalledWith("$RCAnonymousID:abc");
  });

  it("fait réessayer quand le compte de destination n'a pas encore de profil", async () => {
    rcApi.fetchEntitlementState.mockResolvedValue({ active: true, grant: promoGrant });
    db.riderProfile.updateMany.mockResolvedValue({ count: 0 });
    const res = await call({ id: "evt-transfer-2", type: "TRANSFER", transferred_from: [], transferred_to: ["nouveau"] });
    expect(res.status).toBe(503);
  });

  it("n'interroge pas RevenueCat pour un compte d'origine supprimé", async () => {
    rcApi.fetchEntitlementState.mockResolvedValue({ active: true, grant: promoGrant });
    db.riderProfile.findUnique.mockResolvedValue(null);
    const res = await call({ id: "evt-transfer-4", type: "TRANSFER", transferred_from: ["supprime"], transferred_to: ["nouveau"] });
    expect(res.status).toBe(200);
    expect(rcApi.fetchEntitlementState).not.toHaveBeenCalledWith("supprime");
  });

  it("sans clé RevenueCat, n'échoue pas et n'écrit rien", async () => {
    rcApi.isRevenueCatApiConfigured.mockReturnValue(false);
    const res = await call({ id: "evt-transfer-3", type: "TRANSFER", transferred_from: ["a"], transferred_to: ["b"] });
    expect(res.status).toBe(200);
    expect(db.riderProfile.updateMany).not.toHaveBeenCalled();
  });
});
