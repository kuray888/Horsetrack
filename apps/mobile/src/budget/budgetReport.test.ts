import { describe, expect, it } from "vitest";
import { buildBudgetReportLines, budgetCsvRows, expensesOfYear, yearsWithExpenses, type BudgetExpense } from "./budgetReport";

const e = (over: Partial<BudgetExpense> = {}): BudgetExpense => ({
  date: new Date(2026, 2, 5), amount: 100, categoryLabel: "Pension", notes: "", isPaid: true, ...over,
});
const text = (list: BudgetExpense[], year = 2026) =>
  buildBudgetReportLines({ horseName: "Tornade", year, expenses: list }, new Date(2026, 11, 1)).map((l) => ("text" in l ? l.text : "")).join("\n");
const norm = (s: string) => s.replace(/[  ]/g, " ");

describe("expensesOfYear / yearsWithExpenses", () => {
  it("garde l'année demandée, triée par date", () => {
    const list = [e({ date: new Date(2026, 5, 1) }), e({ date: new Date(2025, 0, 1) }), e({ date: new Date(2026, 1, 1) })];
    expect(expensesOfYear(list, 2026).map((x) => x.date.getMonth())).toEqual([1, 5]);
  });
  it("années présentes, la plus récente d'abord", () => {
    expect(yearsWithExpenses([e({ date: new Date(2024, 0, 1) }), e(), e({ date: new Date(2025, 0, 1) })])).toEqual([2026, 2025, 2024]);
  });
});

describe("buildBudgetReportLines", () => {
  it("annonce l'absence de dépenses sans planter", () => {
    expect(text([], 2026)).toContain("Aucune dépense");
    expect(text([e({ date: new Date(2025, 0, 1) })], 2026)).toContain("Aucune dépense");
  });
  it("totaux payé / reste à régler et répartition par catégorie", () => {
    const out = norm(text([e({ amount: 300 }), e({ categoryLabel: "Véto", amount: 120, isPaid: false })]));
    expect(out).toContain("Total : 420,00 €");
    expect(out).toContain("Payé : 300,00 €");
    expect(out).toContain("Reste à régler : 120,00 €");
    expect(out.indexOf("Pension : 300,00 €")).toBeLessThan(out.indexOf("Véto : 120,00 €"));
  });
  it("marque les dépenses à régler et reprend les notes", () => {
    const out = text([e({ isPaid: false, notes: "  Vaccin grippe " })]);
    expect(out).toContain("à régler");
    expect(out).toContain("Vaccin grippe");
  });
  it("n'inclut pas les autres années dans les totaux", () => {
    expect(norm(text([e({ amount: 50 }), e({ amount: 999, date: new Date(2025, 5, 1) })]))).toContain("Total : 50,00 €");
  });
});

describe("budgetCsvRows", () => {
  it("une ligne par dépense de l'année", () => {
    const rows = budgetCsvRows({ horseName: "T", year: 2026, expenses: [e({ amount: 10 }), e({ date: new Date(2025, 1, 1) })] });
    expect(rows).toHaveLength(1);
    expect(rows[0][2]).toBe(10);
  });
});
