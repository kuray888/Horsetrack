import { describe, expect, it } from "vitest";
import { comebackMessage, comebackTriggers } from "./comebackReminderLogic";

describe("comebackTriggers", () => {
  it("programme J+4 et J+11 à 18 h 30, heure locale", () => {
    const now = new Date(2026, 10, 8, 9, 15);
    const [first, second] = comebackTriggers(now);
    expect([first.getFullYear(), first.getMonth(), first.getDate(), first.getHours(), first.getMinutes()]).toEqual([2026, 10, 12, 18, 30]);
    expect([second.getMonth(), second.getDate(), second.getHours()]).toEqual([10, 19, 18]);
  });

  it("passe correctement d'un mois à l'autre", () => {
    const [first] = comebackTriggers(new Date(2026, 0, 30, 22, 0));
    expect([first.getMonth(), first.getDate()]).toEqual([1, 3]);
  });

  it("toujours dans le futur, même tard le soir", () => {
    const now = new Date(2026, 10, 8, 23, 59);
    for (const d of comebackTriggers(now)) expect(d.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe("comebackMessage", () => {
  it("cite le cheval dans les deux relances", () => {
    expect(comebackMessage(0, "Tornade").title).toContain("Tornade");
    expect(comebackMessage(1, "Tornade").title).toContain("Tornade");
  });
});
