import { describe, it, expect } from "vitest";
import { addMonths, buildMonthGrid, groupByDay, startOfMonth } from "./calendar";

describe("calendrier du Planning", () => {
  it("construit 6 semaines commençant un lundi", () => {
    const grid = buildMonthGrid(new Date(2026, 9, 15)); // octobre 2026 (commence un jeudi)
    expect(grid).toHaveLength(42);
    expect(grid[0].getDay()).toBe(1); // lundi
    expect([grid[0].getMonth(), grid[0].getDate()]).toEqual([8, 28]); // lun. 28 sept.
    expect(grid.some((d) => d.getMonth() === 9 && d.getDate() === 31)).toBe(true);
  });

  it("passe d'un mois à l'autre, y compris d'une année à l'autre", () => {
    expect(startOfMonth(new Date(2026, 9, 27)).getDate()).toBe(1);
    const next = addMonths(new Date(2026, 11, 15), 1);
    expect([next.getFullYear(), next.getMonth(), next.getDate()]).toEqual([2027, 0, 1]);
  });

  it("regroupe une liste triée par jour", () => {
    const items = [
      { id: "a", date: new Date(2026, 9, 28, 9) },
      { id: "b", date: new Date(2026, 9, 28, 18) },
      { id: "c", date: new Date(2026, 9, 30, 10) },
    ];
    const groups = groupByDay(items);
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([["a", "b"], ["c"]]);
  });
});
