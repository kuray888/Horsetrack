import { describe, expect, it } from "vitest";
import { planOf, revenueByPlan } from "./adminRevenue";

describe("planOf", () => {
  it("PRO, sinon Premium (palier resté FREE pour les anciens abonnés)", () => {
    expect(planOf("PRO")).toBe("PRO");
    expect(planOf("GRAND_PRIX")).toBe("PREMIUM");
    expect(planOf("FREE")).toBe("PREMIUM");
  });
});

describe("revenueByPlan", () => {
  it("mensuels, annuels ramenés au mois, offerts sans revenu", () => {
    const [premium, pro] = revenueByPlan(
      [
        { tier: "GRAND_PRIX", period: "MONTHLY", count: 10 },
        { tier: "FREE", period: "ANNUAL", count: 12 },
        { tier: "GRAND_PRIX", period: null, count: 3 },
        { tier: "PRO", period: "ANNUAL", count: 2 },
        { tier: "PRO", period: "MONTHLY", count: 1 },
      ],
      [
        { tier: "PRO", count: 4 },
        { tier: "FREE", count: 7 },
      ]
    );
    expect(premium).toEqual({ plan: "PREMIUM", monthly: 10, annual: 12, offered: 3, trials: 7, monthlyRevenue: 79.89 });
    expect(pro).toEqual({ plan: "PRO", monthly: 1, annual: 2, offered: 0, trials: 4, monthlyRevenue: 36.66 });
  });
});
