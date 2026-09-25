import { describe, expect, it } from "vitest";
import {
  hiddenTargetsMessage,
  MAX_ENTRIES_PER_SUBMIT,
  needsExplicitHorseChoice,
  resolveTargetHorseIds,
  selectableHorses,
  shouldOfferHorseChoice,
  targetsOutsideView,
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
    expect(shouldOfferHorseChoice([], [])).toBe(false);
    expect(shouldOfferHorseChoice([owned("a")], ["a"])).toBe(false);
    expect(shouldOfferHorseChoice([owned("a"), owned("b")], ["a"])).toBe(true);
  });

  it("le masque quand l'écran est cadré sur un cheval partagé (hors des proposables)", () => {
    expect(shouldOfferHorseChoice([owned("a"), owned("b")], ["shared-1"])).toBe(false);
  });

  it("l'accepte quand la cible par défaut couvre tous les proposables (vue « Tous »)", () => {
    expect(shouldOfferHorseChoice([owned("a"), owned("b")], ["a", "b"])).toBe(true);
  });
});

describe("targetsOutsideView", () => {
  it("ne signale que les chevaux absents de la vue", () => {
    expect(targetsOutsideView(["a", "b", "c"], ["a"])).toEqual(["b", "c"]);
    expect(targetsOutsideView(["a"], ["a", "b"])).toEqual([]);
  });
});

describe("hiddenTargetsMessage", () => {
  it("accorde le singulier et le pluriel", () => {
    expect(hiddenTargetsMessage([])).toBe("");
    expect(hiddenTargetsMessage(["Bella"])).toContain("Bella, qui n'apparaît pas");
    expect(hiddenTargetsMessage(["Bella", "Sultan", "Nova"])).toContain("Bella, Sultan et Nova, qui n'apparaissent pas");
  });
});

describe("MAX_ENTRIES_PER_SUBMIT", () => {
  it("reste sous la limite iOS de 64 notifications locales en attente", () => {
    expect(MAX_ENTRIES_PER_SUBMIT).toBeLessThan(64);
  });
});

describe("resolveTargetHorseIds", () => {
  const selectable = [owned("a"), owned("b"), owned("c")];

  it("retombe sur la cible par défaut quand aucun choix n'a été fait", () => {
    expect(resolveTargetHorseIds([], selectable, ["a"])).toEqual(["a"]);
  });

  it("vise tous les chevaux quand la cible par défaut les couvre tous", () => {
    expect(resolveTargetHorseIds([], selectable, ["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("ne cible rien quand il n'y a ni choix ni cible par défaut (vue « Tous »)", () => {
    // La vue « Tous » du Planning ne passe AUCUNE cible par défaut : elle
    // mêle l'écurie sans désigner personne, la sélection doit être cochée.
    expect(resolveTargetHorseIds([], selectable, [])).toEqual([]);
  });

  it("respecte le choix explicite, même face à un défaut « tous »", () => {
    expect(resolveTargetHorseIds(["b"], selectable, ["a", "b", "c"])).toEqual(["b"]);
  });

  it("ignore un cheval devenu inutilisable depuis le choix", () => {
    expect(resolveTargetHorseIds(["a", "zzz"], selectable, ["c"])).toEqual(["a"]);
  });

  it("retombe sur la cible par défaut si plus aucun choix n'est valable", () => {
    expect(resolveTargetHorseIds(["zzz"], selectable, ["b"])).toEqual(["b"]);
  });

  it("garde un cheval actif partagé comme cible par défaut, absent des proposables", () => {
    expect(resolveTargetHorseIds([], selectable, ["shared-1"])).toEqual(["shared-1"]);
  });
});

describe("toggleHorseId", () => {
  it("matérialise la cible par défaut avant d'en ajouter un deuxième", () => {
    expect(toggleHorseId([], "b", ["a"])).toEqual(["a", "b"]);
  });

  it("décoche un cheval déjà choisi", () => {
    expect(toggleHorseId(["a", "b"], "a", ["a"])).toEqual(["b"]);
  });

  it("depuis « Tous », décocher un cheval donne tous les autres", () => {
    expect(toggleHorseId([], "b", ["a", "b", "c"])).toEqual(["a", "c"]);
  });

  it("refuse de tout décocher", () => {
    expect(toggleHorseId(["a"], "a", ["a"])).toEqual(["a"]);
    expect(toggleHorseId([], "a", ["a"])).toEqual(["a"]);
  });
});

describe("needsExplicitHorseChoice", () => {
  const selectable = [owned("a"), owned("b"), owned("c")];

  it("bloque une création en vue « Tous » tant qu'aucun cheval n'est coché", () => {
    expect(needsExplicitHorseChoice([], selectable, [])).toBe(true);
  });

  it("laisse passer dès qu'un cheval est coché", () => {
    expect(needsExplicitHorseChoice(["b"], selectable, [])).toBe(false);
  });

  it("laisse passer un écran cadré sur un cheval, qui n'a rien à cocher", () => {
    expect(needsExplicitHorseChoice([], selectable, ["a"])).toBe(false);
  });

  it("ne bloque jamais quand le sélecteur n'est pas proposé", () => {
    // Un seul cheval utilisable : aucune case à l'écran, donc rien à exiger.
    expect(needsExplicitHorseChoice([], [owned("a")], [])).toBe(false);
    // Écran cadré sur un cheval partagé : sélecteur masqué (cf.
    // shouldOfferHorseChoice), la création part sur ce cheval comme avant.
    expect(needsExplicitHorseChoice([], selectable, ["shared-1"])).toBe(false);
  });

  it("bloque encore si le seul cheval coché n'est plus utilisable", () => {
    // Fin d'essai Premium ou cheval supprimé ailleurs : la case survit dans
    // le formulaire, la cible non — on redemande plutôt que de créer ailleurs.
    expect(needsExplicitHorseChoice(["zzz"], selectable, [])).toBe(true);
  });
});

describe("toggleHorseId depuis une vue sans cible par défaut", () => {
  it("coche le premier cheval choisi en vue « Tous »", () => {
    expect(toggleHorseId([], "b", [])).toEqual(["b"]);
  });

  it("refuse toujours de tout décocher une fois un cheval coché", () => {
    expect(toggleHorseId(["b"], "b", [])).toEqual(["b"]);
  });
});
