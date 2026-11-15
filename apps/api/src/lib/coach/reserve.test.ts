import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  coachCall: { count: vi.fn(), create: vi.fn() },
}));
vi.mock("@cheval/db", () => ({
  db: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx), coachCall: { update: vi.fn() }, riderProfile: {} },
}));

import { reserveQuestion } from "./store";
import { QUOTAS } from "./config";

describe("reserveQuestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.coachCall.create.mockResolvedValue({ id: "res1" });
  });

  it("verrouille le compte avant de compter, puis réserve", async () => {
    tx.coachCall.count.mockResolvedValue(0);
    const r = await reserveQuestion("u1", null);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(r.reservationId).toBe("res1");
    expect(r.allowance).toMatchObject({ allowed: true, free: true, left: 3 });
    expect(tx.coachCall.create.mock.calls[0][0].data).toMatchObject({ userId: "u1", kind: "question", status: "pending" });
  });

  it("compte les réservations en cours : pas de dépassement du quota gratuit", async () => {
    tx.coachCall.count.mockResolvedValue(3);
    const r = await reserveQuestion("u1", null);
    expect(r.reservationId).toBeNull();
    expect(tx.coachCall.create).not.toHaveBeenCalled();
    // Le décompte inclut les « pending » récents.
    const where = tx.coachCall.count.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain("pending");
  });

  it("refuse un Premium au bout de son quota mensuel", async () => {
    tx.coachCall.count.mockResolvedValue(QUOTAS.questionsPerMonth);
    const r = await reserveQuestion("u1", QUOTAS);
    expect(r.reservationId).toBeNull();
  });
});
