/**
 * Abonnés et revenu estimé par formule (console /admin) — logique pure,
 * testée. Estimation seulement : prix France TTC, avant la commission
 * d'Apple, sans les offres d'introduction ni les remboursements ; le
 * chiffre qui fait foi reste celui de RevenueCat et d'App Store Connect.
 */

export type Plan = "PREMIUM" | "PRO";

/** Prix validés (cf. docs/ecurie-pro.md, apps/web content/site.ts). */
export const PLAN_PRICES: Record<Plan, { monthly: number; annual: number }> = {
  PREMIUM: { monthly: 3.99, annual: 39.99 },
  PRO: { monthly: 14.99, annual: 129.99 },
};

/** Palier en base → formule. Premium s'est longtemps reconnu au seul statut
 * (palier resté FREE en base) : tout abonné actif hors PRO est Premium. */
export function planOf(tier: string | null): Plan {
  return tier === "PRO" ? "PRO" : "PREMIUM";
}

export type PlanRow = { plan: Plan; monthly: number; annual: number; offered: number; trials: number; monthlyRevenue: number };

export function revenueByPlan(
  active: { tier: string | null; period: "MONTHLY" | "ANNUAL" | null; count: number }[],
  trials: { tier: string | null; count: number }[]
): PlanRow[] {
  return (["PREMIUM", "PRO"] as Plan[]).map((plan) => {
    const rows = active.filter((r) => planOf(r.tier) === plan);
    const sum = (p: "MONTHLY" | "ANNUAL" | null) => rows.filter((r) => r.period === p).reduce((n, r) => n + r.count, 0);
    const monthly = sum("MONTHLY");
    const annual = sum("ANNUAL");
    const price = PLAN_PRICES[plan];
    return {
      plan,
      monthly,
      annual,
      // Sans période : accès offert (code promo, octroi RevenueCat) — pas de revenu.
      offered: sum(null),
      trials: trials.filter((r) => planOf(r.tier) === plan).reduce((n, r) => n + r.count, 0),
      monthlyRevenue: Math.round((monthly * price.monthly + (annual * price.annual) / 12) * 100) / 100,
    };
  });
}
