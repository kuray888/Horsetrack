import { describe, expect, it } from "vitest";
import { OTHER_OPTION } from "@/onboarding/options";
import { durationFor } from "@/planning/sessionForm";

describe("durationFor", () => {
  it("un jour de repos ou de pansage n'a pas de durée : il occupe la journée", () => {
    expect(durationFor({ activityType: "repos", typeSelection: "repos", durationMinutes: 45 })).toBeNull();
    expect(durationFor({ activityType: "pansage", typeSelection: "pansage", durationMinutes: 45 })).toBeNull();
  });
  it("une séance de travail garde la durée choisie", () => {
    expect(durationFor({ activityType: "plat", typeSelection: "plat", durationMinutes: 60 })).toBe(60);
  });

  it("« Autre » garde sa durée, même si le type technique d'avant était un repos", () => {
    expect(durationFor({ activityType: "repos", typeSelection: OTHER_OPTION, durationMinutes: 60 })).toBe(60);
  });
});
