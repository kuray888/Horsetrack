import { describe, it, expect } from "vitest";
import { buildExercises, buildSetupNotes, capAt, HEALTH_CONDITION_RULES, SESSION_META, SESSION_EQUIPMENT } from "./sessionContent";
import type { Horse } from "@/horses/store";

function makeHorse(overrides: Partial<Horse> = {}): Horse {
  return {
    id: "h1",
    name: "Tornado",
    emoji: "🐴",
    photoUrl: null,
    birthYear: 2015,
    sex: "GELDING",
    breed: null,
    heightCm: 165,
    weightKg: 550,
    discipline: "SHOW_JUMPING",
    level: "PRO",
    fitnessLevel: "PEAK",
    workload: "DAILY",
    isPrimary: true,
    strengths: [],
    weaknesses: [],
    temperament: [],
    healthConditions: [],
    restDayActivities: [],
    injuries: [],
    sharedRole: null,
    ...overrides,
  };
}

describe("capAt", () => {
  it("laisse passer une intensité sous le plafond", () => {
    expect(capAt("LOW", "HIGH")).toBe("LOW");
  });
  it("plafonne une intensité au-dessus du maximum", () => {
    expect(capAt("HIGH", "MEDIUM")).toBe("MEDIUM");
  });
});

describe("HEALTH_CONDITION_RULES", () => {
  it("exclut le saut pour un cheval arthrosique", () => {
    expect(HEALTH_CONDITION_RULES.Arthrose.excludeTypes).toContain("OBSTACLE");
    expect(HEALTH_CONDITION_RULES.Arthrose.maxIntensity).toBe("MEDIUM");
  });
});

describe("buildSetupNotes", () => {
  it("donne des repères d'écartement pour les barres au sol", () => {
    const notes = buildSetupNotes("BARRES_AU_SOL", makeHorse(), "MEDIUM", 40);
    expect(notes.some((n) => n.includes("Écartement"))).toBe(true);
  });
  it("ne renvoie rien pour la récupération", () => {
    expect(buildSetupNotes("RECUPERATION", makeHorse(), "LOW", 30)).toEqual([]);
  });
});

describe("buildExercises", () => {
  it("retourne les 4 étapes de base pour un type technique", () => {
    const exercises = buildExercises("DRESSAGE_BASICS", 0, makeHorse(), null, 45);
    expect(exercises.length).toBeGreaterThanOrEqual(4);
    expect(exercises[0].phase).toBe("ECHAUFFEMENT");
    expect(exercises.at(-1)?.phase).toBe("RETOUR_AU_CALME");
  });

  it("fait tourner les variantes selon l'occurrence", () => {
    const first = buildExercises("OBSTACLE", 0, makeHorse(), null, 45);
    const second = buildExercises("OBSTACLE", 1, makeHorse(), null, 45);
    expect(first[0].title).not.toBe(second[0].title);
  });

  it("chaque type de séance a un contenu et un matériel définis", () => {
    for (const type of Object.keys(SESSION_META) as (keyof typeof SESSION_META)[]) {
      expect(SESSION_META[type].exerciseVariants.length).toBeGreaterThan(0);
      expect(SESSION_EQUIPMENT[type].length).toBeGreaterThan(0);
    }
  });
});
