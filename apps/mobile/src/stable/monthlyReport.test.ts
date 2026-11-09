import { describe, expect, it } from "vitest";
import { buildMonthlyReportLines, hoursLabel, inMonth, ridersOf, type MonthlyReportInput, type ReportSession } from "./monthlyReport";

const NOV = new Date(2026, 10, 1);
const s = (over: Partial<ReportSession> = {}): ReportSession => ({
  date: new Date(2026, 10, 10), completed: true, cancelled: false, label: "Dressage", durationMinutes: 60, riderName: "Léa", ...over,
});
const base = (over: Partial<MonthlyReportInput> = {}): MonthlyReportInput => ({
  horseName: "Tornade", month: NOV, sessions: [], care: [], weights: [], tasks: null, expenses: null, fees: null, ...over,
});
const text = (input: MonthlyReportInput) => buildMonthlyReportLines(input, new Date(2026, 11, 1)).map((l) => ("text" in l ? l.text : "")).join("\n");

describe("ridersOf", () => {
  it("séances faites par cavalier, du plus actif au moins actif, les annulées exclues", () => {
    const list = ridersOf([s(), s({ riderName: "Marc", durationMinutes: 30 }), s(), s({ completed: false }), s({ cancelled: true }), s({ riderName: null })]);
    expect(list).toEqual([
      { name: "Léa", sessions: 2, minutes: 120 },
      { name: "Marc", sessions: 1, minutes: 30 },
      { name: null, sessions: 1, minutes: 60 },
    ]);
  });
});

describe("hoursLabel / inMonth", () => {
  it("durées lisibles", () => {
    expect(hoursLabel(0)).toBe("");
    expect(hoursLabel(45)).toBe("45 min");
    expect(hoursLabel(120)).toBe("2 h");
    expect(hoursLabel(95)).toBe("1 h 35");
  });
  it("mois et année", () => {
    expect(inMonth(new Date(2026, 10, 30), NOV)).toBe(true);
    expect(inMonth(new Date(2025, 10, 30), NOV)).toBe(false);
  });
});

describe("buildMonthlyReportLines", () => {
  it("séances du mois, cavaliers, soins et pesées ; rien du mois d'avant", () => {
    const out = text(
      base({
        sessions: [s(), s({ riderName: "Marc" }), s({ date: new Date(2026, 9, 28) }), s({ completed: false })],
        care: [{ date: new Date(2026, 10, 5), typeLabel: "Vermifuge", title: "Vermifuge", professional: "Dr Martin" }],
        weights: [{ date: new Date(2026, 10, 3), weightKg: 540 }],
      })
    );
    expect(out).toContain("Rapport de");
    expect(out).toContain("Tornade");
    expect(out).toContain("2 séance(s) faite(s) sur 3 prévue(s)");
    expect(out).toContain("Léa : 1 séance(s)");
    expect(out).toContain("Marc : 1 séance(s)");
    expect(out).toContain("Dr Martin");
    expect(out).toContain("540 kg");
  });

  it("dépenses et frais seulement quand fournis (droits du lecteur)", () => {
    expect(text(base())).not.toContain("Dépenses");
    expect(text(base())).not.toContain("Participation aux frais");
    const out = text(
      base({
        expenses: [{ date: new Date(2026, 10, 2), amount: 120, label: "Vétérinaire" }],
        fees: { total: 150, paid: 150, due: 0 },
      })
    );
    expect(out).toContain("Dépenses");
    expect(out).toContain("Participation aux frais");
  });

  it("mois vide : dit qu'il n'y a rien, sans inventer", () => {
    const out = text(base());
    expect(out).toContain("Aucune séance ce mois-ci.");
    expect(out).toContain("Aucun soin ce mois-ci.");
  });
});
