import { describe, expect, it } from "vitest";
import { OTHER_OPTION } from "@/onboarding/options";
import { allowsFullDay, durationFor, emptyForm, formFromSession } from "@/planning/sessionForm";
import type { TrainingSession } from "@/sessions/store";

describe("durationFor", () => {
  it("paddock : « Journée complète » enregistre la séance sans durée", () => {
    expect(durationFor({ activityType: "liberte", typeSelection: "liberte", durationMinutes: 45, fullDay: true })).toBeNull();
  });
  it("paddock avec une durée choisie : la garde", () => {
    expect(durationFor({ activityType: "liberte", typeSelection: "liberte", durationMinutes: 30, fullDay: false })).toBe(30);
  });
  it("« Journée complète » ne s'applique qu'au paddock : une séance de plat garde sa durée", () => {
    expect(durationFor({ activityType: "plat", typeSelection: "plat", durationMinutes: 60, fullDay: true })).toBe(60);
  });
  it("un jour de repos n'a pas de durée : il occupe la journée", () => {
    expect(durationFor({ activityType: "repos", typeSelection: "repos", durationMinutes: 45 })).toBeNull();
  });
  it("le pansage a une heure et une durée comme les autres séances (retour du 16/11)", () => {
    expect(durationFor({ activityType: "pansage", typeSelection: "pansage", durationMinutes: 45 })).toBe(45);
  });
  it("une séance de travail garde la durée choisie", () => {
    expect(durationFor({ activityType: "plat", typeSelection: "plat", durationMinutes: 60 })).toBe(60);
  });

  it("« Autre » garde sa durée, même si le type technique d'avant était un repos", () => {
    expect(durationFor({ activityType: "repos", typeSelection: OTHER_OPTION, durationMinutes: 60 })).toBe(60);
  });
});

describe("allowsFullDay / formFromSession", () => {
  it("seul le paddock propose « Journée complète » en plus des durées", () => {
    expect(allowsFullDay({ activityType: "liberte", typeSelection: "liberte" })).toBe(true);
    expect(allowsFullDay({ activityType: "plat", typeSelection: "plat" })).toBe(false);
    expect(allowsFullDay({ activityType: "liberte", typeSelection: OTHER_OPTION })).toBe(false);
  });
  it("un paddock enregistré sans durée se rouvre sur « Journée complète »", () => {
    const base = { ...emptyForm(), id: "s1" } as unknown as TrainingSession;
    expect(formFromSession({ ...base, activityType: "liberte", durationMinutes: null } as TrainingSession).fullDay).toBe(true);
    expect(formFromSession({ ...base, activityType: "liberte", durationMinutes: 30 } as TrainingSession).fullDay).toBe(false);
    expect(emptyForm().fullDay).toBe(false);
  });
});
