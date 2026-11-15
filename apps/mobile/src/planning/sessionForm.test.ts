import { describe, expect, it } from "vitest";
import { durationFor } from "@/planning/sessionForm";

describe("durationFor", () => {
  it("un jour de repos ou de pansage n'a pas de durée : il occupe la journée", () => {
    expect(durationFor({ activityType: "repos", durationMinutes: 45 })).toBeNull();
    expect(durationFor({ activityType: "pansage", durationMinutes: 45 })).toBeNull();
  });
  it("une séance de travail garde la durée choisie", () => {
    expect(durationFor({ activityType: "plat", durationMinutes: 60 })).toBe(60);
  });
});
