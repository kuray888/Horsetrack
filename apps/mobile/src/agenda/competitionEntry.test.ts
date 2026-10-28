import { describe, expect, it } from "vitest";
import { cleanCompetitionEntry, competitionEntryTimeLabel } from "./competitionEntry";

const entry = (name: string, time: string) => ({ name, discipline: "SHOW_JUMPING" as const, time });

describe("cleanCompetitionEntry", () => {
  it("un nom suffit : l'épreuve sans heure est gardée, heure vide", () => {
    expect(cleanCompetitionEntry(entry("Grand Prix 1m30", ""))).toEqual(entry("Grand Prix 1m30", ""));
  });

  it("une heure faite d'espaces est une heure absente, pas une valeur", () => {
    expect(cleanCompetitionEntry(entry("Vitesse", "   "))!.time).toBe("");
  });

  it("nettoie le nom et l'heure", () => {
    expect(cleanCompetitionEntry(entry("  Six barres ", " 09h15 "))).toEqual(entry("Six barres", "09h15"));
  });

  it("sans nom, rien à enregistrer — même avec une heure", () => {
    expect(cleanCompetitionEntry(entry("", "09h15"))).toBeNull();
    expect(cleanCompetitionEntry(entry("   ", ""))).toBeNull();
  });

  it("garde les autres champs (identifiant, résultat)", () => {
    expect(cleanCompetitionEntry({ ...entry("GP", ""), id: "ce1", result: "2e" })).toEqual({
      ...entry("GP", ""),
      id: "ce1",
      result: "2e",
    });
  });
});

describe("competitionEntryTimeLabel", () => {
  it("affiche l'heure, ou « heure à venir » quand elle manque", () => {
    expect(competitionEntryTimeLabel("09h15")).toBe("09h15");
    expect(competitionEntryTimeLabel("")).toBe("heure à venir");
    expect(competitionEntryTimeLabel("  ")).toBe("heure à venir");
    expect(competitionEntryTimeLabel(null)).toBe("heure à venir");
  });
});
