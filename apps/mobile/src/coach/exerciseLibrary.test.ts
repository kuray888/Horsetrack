import { describe, expect, it } from "vitest";
import { exerciseById, filterLibrary, libraryExercises } from "@/coach/exerciseLibrary";

describe("bibliothèque d'exercices", () => {
  const all = libraryExercises();

  it("donne un identifiant stable et unique à chaque exercice", () => {
    expect(all.length).toBeGreaterThan(80);
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
    expect(exerciseById("DRESSAGE_BASICS.0.0")?.phase).toBe("ECHAUFFEMENT");
    expect(exerciseById("INCONNU.9.9")).toBeNull();
  });

  it("cherche sans tenir compte des accents ni de la casse", () => {
    const hits = filterLibrary(all, { query: "epaule dedans" });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((e) => /paule/i.test(e.title + e.description))).toBe(true);
  });

  it("filtre par discipline, niveau, matériel et favoris", () => {
    expect(filterLibrary(all, { discipline: "LEISURE" }).some((e) => e.type === "OBSTACLE")).toBe(false);
    expect(filterLibrary(all, { horseLevel: "UNTRAINED" }).some((e) => e.type === "OBSTACLE")).toBe(false);
    expect(filterLibrary(all, { noEquipment: true }).some((e) => e.type === "BARRES_AU_SOL")).toBe(false);
    const fav = new Set(["ASSOUPLISSEMENT.1.1"]);
    expect(filterLibrary(all, { favoritesOnly: true, favorites: fav }).map((e) => e.id)).toEqual(["ASSOUPLISSEMENT.1.1"]);
  });
});
