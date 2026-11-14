import { describe, expect, it } from "vitest";
import { ENGAGEMENT_PRIORITY, pickEngagementCard } from "./engagementSlotLogic";

describe("pickEngagementCard", () => {
  it("n'affiche rien quand aucune carte ne le demande", () => {
    expect(pickEngagementCard([])).toBeNull();
  });

  it("une seule carte, la plus prioritaire", () => {
    expect(pickEngagementCard(["referral", "first_steps", "reminders_upsell"])).toBe("first_steps");
    expect(pickEngagementCard(["referral", "winback"])).toBe("winback");
    expect(pickEngagementCard(["referral"])).toBe("referral");
  });

  it("le bilan du mois passe avant les offres Premium", () => {
    expect(pickEngagementCard(["reminders_upsell", "monthly_recap"])).toBe("monthly_recap");
  });

  it("chaque carte figure une fois dans l'ordre", () => {
    expect(new Set(ENGAGEMENT_PRIORITY).size).toBe(ENGAGEMENT_PRIORITY.length);
  });
});
