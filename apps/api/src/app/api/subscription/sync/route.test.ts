import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUserIdFromRequest: vi.fn(),
  fetchEntitlementState: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/supabaseAdmin", () => ({ getUserIdFromRequest: mocks.getUserIdFromRequest }));
vi.mock("@/lib/revenuecatApi", () => ({ fetchEntitlementState: mocks.fetchEntitlementState }));
vi.mock("@cheval/db", () => ({
  db: { riderProfile: { updateMany: mocks.updateMany } },
  SubscriptionStatus: { ACTIVE: "ACTIVE", TRIALING: "TRIALING", EXPIRED: "EXPIRED" },
}));

import { POST } from "./route";

const req = () => new NextRequest("https://api.test/api/subscription/sync", { method: "POST" });
const grant = { subscriptionTier: "GRAND_PRIX", subscriptionStatus: "ACTIVE", billingPeriod: null, trialEndsAt: null };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserIdFromRequest.mockResolvedValue("user-1");
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

describe("POST /api/subscription/sync", () => {
  it("refuse un appel non authentifié", async () => {
    mocks.getUserIdFromRequest.mockResolvedValue(null);
    expect((await POST(req())).status).toBe(401);
  });

  it("recopie l'accès confirmé par RevenueCat sur le compte de l'appelant uniquement", async () => {
    mocks.fetchEntitlementState.mockResolvedValue({ active: true, grant });
    const res = await POST(req());
    expect(await res.json()).toMatchObject({ synced: true, active: true });
    expect(mocks.fetchEntitlementState).toHaveBeenCalledWith("user-1");
    expect(mocks.updateMany.mock.calls[0][0]).toMatchObject({ where: { userId: "user-1" }, data: grant });
  });

  it("ne rétrograde jamais, même si RevenueCat ne voit plus d'accès", async () => {
    mocks.fetchEntitlementState.mockResolvedValue({ active: false });
    const res = await POST(req());
    expect(await res.json()).toMatchObject({ synced: true, active: false });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("n'écrit rien quand RevenueCat est injoignable ou la clé absente", async () => {
    mocks.fetchEntitlementState.mockResolvedValue(null);
    expect(await (await POST(req())).json()).toEqual({ synced: false });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("signale un profil pas encore créé pour que l'app retente", async () => {
    mocks.fetchEntitlementState.mockResolvedValue({ active: true, grant });
    mocks.updateMany.mockResolvedValue({ count: 0 });
    expect(await (await POST(req())).json()).toMatchObject({ synced: false, outcome: "no-profile" });
  });
});
