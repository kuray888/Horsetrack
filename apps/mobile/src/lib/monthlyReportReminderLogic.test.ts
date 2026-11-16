import { describe, expect, it } from "vitest";
import { isInternalRoute } from "./notificationLinks";
import { monthlyReportMessage, monthlyReportUrl, nextMonthlyReportTrigger } from "./monthlyReportReminderLogic";

describe("bilan du mois", () => {
  it("part le 1er du mois suivant à 10 h, même en décembre", () => {
    expect(nextMonthlyReportTrigger(new Date(2026, 10, 16, 20))).toEqual(new Date(2026, 11, 1, 10));
    expect(nextMonthlyReportTrigger(new Date(2026, 11, 31, 23))).toEqual(new Date(2027, 0, 1, 10));
  });
  it("parle du mois qui vient de finir", () => {
    expect(monthlyReportMessage(new Date(2027, 0, 1, 10), "Tornado").title).toContain("décembre");
    expect(monthlyReportMessage(new Date(2027, 0, 1, 10), "Tornado").title).toContain("Tornado");
  });
  it("ouvre le rapport du cheval, chemin interne", () => {
    expect(monthlyReportUrl("h1")).toBe("/horse/h1/rapport");
    expect(isInternalRoute(monthlyReportUrl("h1"))).toBe(true);
  });
});
