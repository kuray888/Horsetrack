import { describe, expect, it } from "vitest";
import { MIN_QUERY_LENGTH, normalize, searchEntries, type SearchResult } from "@/search/search";

const entry = (over: Partial<SearchResult> = {}): SearchResult => ({
  kind: "appointment",
  id: "a1",
  title: "Vaccin annuel",
  subtitle: "Dr Martin",
  date: new Date(2026, 8, 20),
  horseId: "h1",
  ...over,
});

describe("normalize", () => {
  it("ignore la casse et les accents, que personne ne tape", () => {
    expect(normalize("Vétérinaire")).toBe("veterinaire");
  });
});

describe("searchEntries", () => {
  const entries = [
    entry(),
    entry({ id: "a2", title: "Maréchal", subtitle: "Parage", date: new Date(2026, 7, 5) }),
    entry({ id: "j1", kind: "journal", title: "Dressage", subtitle: "Très tendu au début", date: new Date(2026, 8, 21) }),
  ];

  it("trouve malgré les accents et la casse", () => {
    expect(searchEntries(entries, "marechal").map((r) => r.id)).toEqual(["a2"]);
    expect(searchEntries(entries, "MARÉCHAL").map((r) => r.id)).toEqual(["a2"]);
  });

  it("cherche aussi dans le contexte, pas seulement le titre", () => {
    expect(searchEntries(entries, "martin").map((r) => r.id)).toEqual(["a1"]);
    expect(searchEntries(entries, "tendu").map((r) => r.id)).toEqual(["j1"]);
  });

  it("exige tous les mots, sans les vouloir contigus ni dans l'ordre", () => {
    expect(searchEntries(entries, "vaccin martin").map((r) => r.id)).toEqual(["a1"]);
    expect(searchEntries(entries, "martin vaccin").map((r) => r.id)).toEqual(["a1"]);
    expect(searchEntries(entries, "vaccin marechal")).toEqual([]);
  });

  it("rend le plus récent d'abord : ce qu'on cherche l'est presque toujours", () => {
    // « ar » est dans « Dr Martin » (20 sept.) et « Maréchal » (5 août).
    expect(searchEntries(entries, "ar").map((r) => r.id)).toEqual(["a1", "a2"]);
  });

  it("ne répond pas à une requête trop courte, qui ramènerait tout", () => {
    // Un seul caractère ramènerait la moitié de l'historique.
    expect(searchEntries(entries, "a".repeat(MIN_QUERY_LENGTH - 1))).toEqual([]);
    expect(searchEntries(entries, "   ")).toEqual([]);
    expect(searchEntries(entries, "")).toEqual([]);
  });
});
