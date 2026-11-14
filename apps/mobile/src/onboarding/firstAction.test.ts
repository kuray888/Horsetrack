import { describe, expect, it } from "vitest";
import {
  dayKey,
  defaultSessionActivity,
  firstActionDate,
  parseDayKey,
  presetDate,
  reviveFirstAction,
  type FirstActionDraft,
} from "./firstAction";

const NOW = new Date(2026, 10, 14, 15, 30); // 14 novembre 2026, 15 h 30

describe("première action de l'onboarding", () => {
  it("dates rapides en jours locaux, à minuit", () => {
    expect(dayKey(presetDate("today", NOW))).toBe("2026-11-14");
    expect(dayKey(presetDate("tomorrow", NOW))).toBe("2026-11-15");
    expect(dayKey(presetDate("in_2_days", NOW))).toBe("2026-11-16");
    expect(dayKey(presetDate("in_1_week", NOW))).toBe("2026-11-21");
    expect(dayKey(presetDate("in_2_weeks", NOW))).toBe("2026-11-28");
    expect(dayKey(presetDate("in_1_month", NOW))).toBe("2026-12-14");
    expect(dayKey(presetDate("in_2_months", NOW))).toBe("2027-01-14");
    expect(presetDate("in_1_week", NOW).getHours()).toBe(0);
  });

  it("dayKey et parseDayKey font l'aller-retour", () => {
    expect(dayKey(parseDayKey("2027-01-05")!)).toBe("2027-01-05");
    expect(parseDayKey("05/01/2027")).toBeNull();
  });

  it("séance pré-choisie d'après la discipline", () => {
    expect(defaultSessionActivity("SHOW_JUMPING")).toBe("cso");
    expect(defaultSessionActivity("LEISURE")).toBe("balade");
    expect(defaultSessionActivity("DRESSAGE")).toBe("dressage");
    expect(defaultSessionActivity(null)).toBe("dressage");
  });

  it("relit un brouillon valide, après passage en JSON", () => {
    const care: FirstActionDraft = { kind: "care", careType: "marechal", day: "2026-11-28", reminder: true };
    const session: FirstActionDraft = { kind: "session", activity: "balade", day: "2026-11-15" };
    expect(reviveFirstAction(JSON.parse(JSON.stringify(care)))).toEqual(care);
    expect(reviveFirstAction(JSON.parse(JSON.stringify(session)))).toEqual(session);
  });

  it("écarte un brouillon incohérent plutôt que d'inventer un rendez-vous", () => {
    expect(reviveFirstAction(null)).toBeNull();
    expect(reviveFirstAction({ kind: "care", careType: "concours", day: "2026-11-28" })).toBeNull();
    expect(reviveFirstAction({ kind: "session", activity: "balade", day: "demain" })).toBeNull();
    expect(reviveFirstAction({ kind: "autre", day: "2026-11-28" })).toBeNull();
    // Rappel absent : jamais supposé accordé.
    expect(reviveFirstAction({ kind: "care", careType: "veto", day: "2026-11-28" })).toEqual({
      kind: "care",
      careType: "veto",
      day: "2026-11-28",
      reminder: false,
    });
  });

  it("ne crée rien pour une date déjà passée (brouillon repris trop tard)", () => {
    const later = new Date(2026, 10, 20, 8);
    expect(firstActionDate({ kind: "session", activity: "cso", day: "2026-11-15" }, later)).toBeNull();
    expect(dayKey(firstActionDate({ kind: "session", activity: "cso", day: "2026-11-20" }, later)!)).toBe("2026-11-20");
  });
});
