import { describe, it, expect } from "vitest";
import { applyNextDueShortcut, nextDueShortcuts } from "./nextDue";

describe("raccourcis de prochaine échéance", () => {
  it("propose des écarts adaptés au soin, et rien hors soin", () => {
    expect(nextDueShortcuts("marechal").map((s) => s.label)).toEqual(["6 sem.", "8 sem.", "10 sem."]);
    expect(nextDueShortcuts("vaccination").map((s) => s.label)).toEqual(["6 mois", "1 an"]);
    expect(nextDueShortcuts("concours")).toEqual([]);
    expect(nextDueShortcuts("autre")).toEqual([]);
  });

  it("compte en semaines ou en mois calendaires depuis le rendez-vous", () => {
    const from = new Date(2026, 9, 27, 15, 30);
    const six = applyNextDueShortcut(from, { label: "6 sem.", weeks: 6 });
    expect([six.getFullYear(), six.getMonth(), six.getDate(), six.getHours()]).toEqual([2026, 11, 8, 0]);
    const year = applyNextDueShortcut(from, { label: "1 an", months: 12 });
    expect([year.getFullYear(), year.getMonth(), year.getDate()]).toEqual([2027, 9, 27]);
  });

  it("retombe sur le dernier jour d'un mois plus court", () => {
    const d = applyNextDueShortcut(new Date(2027, 0, 31), { label: "1 mois", months: 1 });
    expect([d.getMonth(), d.getDate()]).toEqual([1, 28]);
  });
});
