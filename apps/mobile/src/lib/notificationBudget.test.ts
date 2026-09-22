import { describe, expect, it } from "vitest";
import {
  IOS_PENDING_NOTIFICATION_LIMIT,
  remainingReminderSlots,
  reminderBudgetWarning,
} from "@/lib/notificationBudget";

describe("remainingReminderSlots", () => {
  it("décompte à partir du plafond iOS", () => {
    expect(remainingReminderSlots(0)).toBe(IOS_PENDING_NOTIFICATION_LIMIT);
    expect(remainingReminderSlots(60)).toBe(4);
  });

  it("ne descend jamais sous zéro : une limite dépassée n'est pas une dette", () => {
    expect(remainingReminderSlots(IOS_PENDING_NOTIFICATION_LIMIT)).toBe(0);
    expect(remainingReminderSlots(120)).toBe(0);
  });
});

describe("reminderBudgetWarning", () => {
  it("ne dit rien tant que ça rentre", () => {
    expect(reminderBudgetWarning(0, 10)).toBeNull();
    expect(reminderBudgetWarning(54, 10)).toBeNull();
  });

  it("avertit dès qu'un rappel serait perdu", () => {
    const message = reminderBudgetWarning(60, 5);
    expect(message).toContain("Un rappel");
    expect(message).toContain(String(IOS_PENDING_NOTIFICATION_LIMIT));
  });

  it("compte les rappels réellement perdus, pas ceux demandés", () => {
    // 4 places libres, 10 demandés : 6 passent à la trappe.
    expect(reminderBudgetWarning(60, 10)).toContain("6 rappels");
  });

  it("rassure sur ce qui compte : le rendez-vous est enregistré", () => {
    expect(reminderBudgetWarning(64, 1)).toContain("sera bien enregistré");
  });

  it("accorde le singulier sur les rappels déjà programmés", () => {
    expect(reminderBudgetWarning(1, 64)).toContain("1 rappel est déjà programmé");
    expect(reminderBudgetWarning(2, 64)).toContain("2 rappels sont déjà programmés");
  });
});
