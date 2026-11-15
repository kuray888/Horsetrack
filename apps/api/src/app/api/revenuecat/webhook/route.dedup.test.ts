import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const del = vi.fn();
const findUnique = vi.fn();
const updateMany = vi.fn();

vi.mock("@cheval/db", () => ({
  db: {
    revenueCatWebhookEvent: { create: (...a: unknown[]) => create(...a), delete: (...a: unknown[]) => del(...a) },
    riderProfile: { findUnique: (...a: unknown[]) => findUnique(...a), updateMany: (...a: unknown[]) => updateMany(...a) },
  },
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  SubscriptionStatus: { EXPIRED: "EXPIRED" },
  SubscriptionTier: { PRO: "PRO", GRAND_PRIX: "GRAND_PRIX" },
}));
vi.mock("@/lib/analytics", () => ({ analyticsEventForRevenueCat: () => null, captureServerEvent: vi.fn() }));
vi.mock("@/lib/revenuecatApi", () => ({
  fetchEntitlementState: vi.fn(),
  isAnonymousAppUserId: () => false,
  isRevenueCatApiConfigured: () => false,
}));
vi.mock("@/lib/subscriptionSync", () => ({ applyEntitlementState: vi.fn() }));
vi.mock("@/lib/promoConversion", () => ({ recordOfferCodeConversion: vi.fn() }));
vi.mock("@/lib/referralReward", () => ({ rewardReferrerIfDue: vi.fn() }));

import { POST } from "./route";

function request(event: object) {
  return new Request("http://x/api/revenuecat/webhook", {
    method: "POST",
    headers: { authorization: "Bearer secret" },
    body: JSON.stringify({ event }),
  }) as never;
}
const expiration = (id: string) => ({
  id,
  type: "EXPIRATION",
  app_user_id: "u1",
  entitlement_ids: ["grand_prix"],
  event_timestamp_ms: 10,
});

describe("webhook RevenueCat : traitement qui échoue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVENUECAT_WEBHOOK_SECRET = "secret";
    create.mockResolvedValue({});
    findUnique.mockResolvedValue({ id: "p" });
    del.mockResolvedValue({});
  });

  it("rend le claim de l'événement pour que la relivraison soit traitée", async () => {
    updateMany.mockRejectedValue(new Error("pooler indisponible"));
    await expect(POST(request(expiration("evt1")))).rejects.toThrow("pooler");
    expect(del).toHaveBeenCalledWith({ where: { id: "evt1" } });
  });

  it("garde le claim quand tout s'est bien passé", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const res = await POST(request(expiration("evt2")));
    expect(res.status).toBe(200);
    expect(del).not.toHaveBeenCalled();
  });
});
