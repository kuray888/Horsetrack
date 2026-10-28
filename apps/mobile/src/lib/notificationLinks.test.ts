import { describe, it, expect } from "vitest";
import { appointmentReminderUrl, isInternalRoute, nextDueReminderUrl, WEEKLY_SUMMARY_URL } from "./notificationLinks";

describe("destinations des notifications", () => {
  it("mène un soin à la page Santé du cheval", () => {
    expect(appointmentReminderUrl("veto", "h1")).toBe("/horse/h1/sante");
    expect(appointmentReminderUrl("vaccination", "h1")).toBe("/horse/h1/sante");
    expect(nextDueReminderUrl("h1")).toBe("/horse/h1/sante");
  });

  it("mène un concours ou un autre rendez-vous au Planning", () => {
    expect(appointmentReminderUrl("concours", "h1")).toBe("/(tabs)/planning?filter=concours");
    expect(appointmentReminderUrl("autre", "h1")).toBe("/(tabs)/planning");
    expect(appointmentReminderUrl("veto", null)).toBe("/(tabs)/planning");
    expect(nextDueReminderUrl(null)).toBe("/(tabs)/planning");
  });

  it("produit toujours des chemins internes valides", () => {
    for (const url of [
      appointmentReminderUrl("veto", "3f2a-9b"),
      appointmentReminderUrl("concours", "h1"),
      nextDueReminderUrl("h1"),
      WEEKLY_SUMMARY_URL,
    ]) {
      expect(isInternalRoute(url)).toBe(true);
    }
  });

  it("refuse tout ce qui sortirait de l'app", () => {
    expect(isInternalRoute("https://evil.fr")).toBe(false);
    expect(isInternalRoute("//evil.fr/x")).toBe(false);
    expect(isInternalRoute("javascript:alert(1)")).toBe(false);
    expect(isInternalRoute("/horse/../../etc")).toBe(false);
    expect(isInternalRoute("/horse/h1 sante")).toBe(false);
    expect(isInternalRoute(undefined)).toBe(false);
    expect(isInternalRoute(42)).toBe(false);
  });
});
