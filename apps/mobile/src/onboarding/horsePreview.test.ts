import { describe, expect, it } from "vitest";
import { horsePreview } from "@/onboarding/horsePreview";

const empty = {
  name: "",
  birthYear: null,
  sex: null,
  breed: null,
  coat: null,
  heightCm: null,
  weightKg: null,
  discipline: null,
} as const;
const now = new Date(2026, 9, 28);

describe("aperçu de la fiche avant le paywall", () => {
  it("rend ce qui a été saisi, dans l'ordre de lecture", () => {
    const p = horsePreview(
      { ...empty, name: " Éclair ", birthYear: 2018, sex: "MARE", breed: "Selle Français", coat: "Bai", heightCm: 165, weightKg: 550, discipline: "DRESSAGE" },
      null,
      now
    );
    expect(p.name).toBe("Éclair");
    expect(p.subtitle).toBe("Jument · 8 ans · Selle Français · Bai");
    expect(p.facts).toEqual([
      { label: "Discipline", value: "Dressage" },
      { label: "Taille", value: "165 cm" },
      { label: "Poids", value: "550 kg" },
      { label: "Né en", value: "2018" },
    ]);
  });

  it("n'invente rien : le nom seul donne une fiche sobre", () => {
    const p = horsePreview({ ...empty, name: "Quabar" }, null, now);
    expect(p.subtitle).toBeNull();
    expect(p.facts).toEqual([]);
  });

  it("reprend la discipline du cavalier si celle du cheval manque", () => {
    expect(horsePreview({ ...empty, name: "Q" }, "SHOW_JUMPING", now).facts[0]).toEqual({
      label: "Discipline",
      value: "Saut d'obstacles (CSO)",
    });
  });

  it("accorde l'âge d'un poulain", () => {
    expect(horsePreview({ ...empty, name: "P", birthYear: 2026 }, null, now).subtitle).toBe("moins d'un an");
    expect(horsePreview({ ...empty, name: "P", birthYear: 2025 }, null, now).subtitle).toBe("1 an");
  });
});
