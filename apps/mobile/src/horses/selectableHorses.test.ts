import { describe, expect, it } from "vitest";
import {
  resolveTargetHorseIds,
  selectableHorses,
  shouldOfferHorseChoice,
  toggleHorseId,
} from "@/horses/selectableHorses";

const owned = (id: string) => ({ id, sharedRole: null });
const shared = (id: string) => ({ id, sharedRole: "DEMI_PENSION" as const });

describe("selectableHorses", () => {
  it("exclut les chevaux possédés au-delà de la limite du palier", () => {
    const horses = [owned("a"), owned("b"), owned("c")];
    expect(selectableHorses(horses, 1).map((h) => h.id)).toEqual(["a"]);
    expect(selectableHorses(horses, Infinity).map((h) => h.id)).toEqual(["a", "b", "c"]);
  });

  it("exclut les chevaux partagés, sans jamais les compter dans le quota", () => {
    // Le partagé est intercalé : s'il comptait dans le rang, "b" passerait
    // pour le 3e cheval possédé et serait verrouillé à tort.
    const horses = [owned("a"), shared("s"), owned("b")];
    expect(selectableHorses(horses, 2).map((h) => h.id)).toEqual(["a", "b"]);
    expect(selectableHorses(horses, Infinity).some((h) => h.id === "s")).toBe(false);
  });
});

describe("shouldOfferHorseChoice", () => {
  it("ne propose un choix qu'à partir de deux chevaux utilisables", () => {
    expect(shouldOfferHorseChoice([])).toBe(false);
    expect(shouldOfferHorseChoice([owned("a")])).toBe(false);
    expect(shouldOfferHorseChoice([owned("a"), owned("b")])).toBe(true);
  });
});

describe("resolveTargetHorseIds", () => {
  const selectable = [owned("a"), owned("b")];

  it("retombe sur le cheval actif quand aucun choix n'a été fait", () => {
    expect(resolveTargetHorseIds([], selectable, "a")).toEqual(["a"]);
  });

  it("ne cible rien quand il n'y a ni choix ni cheval actif", () => {
    expect(resolveTargetHorseIds([], selectable, null)).toEqual([]);
  });

  it("respecte le choix explicite", () => {
    expect(resolveTargetHorseIds(["a", "b"], selectable, "a")).toEqual(["a", "b"]);
  });

  it("ignore un cheval devenu inutilisable depuis le choix", () => {
    expect(resolveTargetHorseIds(["a", "zzz"], selectable, "a")).toEqual(["a"]);
  });

  it("retombe sur le cheval actif si plus aucun choix n'est valable", () => {
    expect(resolveTargetHorseIds(["zzz"], selectable, "b")).toEqual(["b"]);
  });
});

describe("toggleHorseId", () => {
  it("matérialise le cheval actif avant d'en ajouter un deuxième", () => {
    expect(toggleHorseId([], "b", "a")).toEqual(["a", "b"]);
  });

  it("décoche un cheval déjà choisi", () => {
    expect(toggleHorseId(["a", "b"], "a", "a")).toEqual(["b"]);
  });

  it("refuse de tout décocher", () => {
    expect(toggleHorseId(["a"], "a", "a")).toEqual(["a"]);
    expect(toggleHorseId([], "a", "a")).toEqual(["a"]);
  });
});
