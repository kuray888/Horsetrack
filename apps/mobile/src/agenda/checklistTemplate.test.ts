import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHECKLIST_LABELS,
  MAX_CHECKLIST_ITEMS,
  applyChecklistTemplate,
  buildChecklist,
  normalizeChecklistLabels,
} from "./checklistTemplate";

function counter() {
  let n = 0;
  return () => `new${++n}`;
}

describe("normalizeChecklistLabels", () => {
  it("retire espaces, lignes vides et doublons sans tenir compte de la casse", () => {
    expect(normalizeChecklistLabels(["  Casque ", "", "casque", "Gilet", "   "])).toEqual(["Casque", "Gilet"]);
  });

  it("plafonne le nombre d'éléments", () => {
    const many = Array.from({ length: MAX_CHECKLIST_ITEMS + 10 }, (_, i) => `Élément ${i}`);
    expect(normalizeChecklistLabels(many)).toHaveLength(MAX_CHECKLIST_ITEMS);
  });
});

describe("buildChecklist", () => {
  it("crée une checklist neuve, rien de coché, un identifiant distinct par élément", () => {
    const items = buildChecklist(["A", "B"], counter());
    expect(items).toEqual([
      { id: "new1", label: "A", checked: false },
      { id: "new2", label: "B", checked: false },
    ]);
  });

  it("la liste par défaut donne 9 éléments", () => {
    expect(buildChecklist(DEFAULT_CHECKLIST_LABELS, counter())).toHaveLength(9);
  });
});

describe("applyChecklistTemplate", () => {
  const previous = ["Casque", "Gilet"];

  it("garde l'identifiant et la case cochée d'un élément déjà présent", () => {
    const current = [{ id: "x1", label: "Casque", checked: true }];
    const result = applyChecklistTemplate(current, previous, ["Casque", "Bottes"], counter());
    expect(result).toEqual([
      { id: "x1", label: "Casque", checked: true },
      { id: "new1", label: "Bottes", checked: false },
    ]);
  });

  it("retire un élément de l'ancienne liste type absent de la nouvelle", () => {
    const current = [
      { id: "x1", label: "Casque", checked: false },
      { id: "x2", label: "Gilet", checked: true },
    ];
    const result = applyChecklistTemplate(current, previous, ["Casque"], counter());
    expect(result.map((i) => i.label)).toEqual(["Casque"]);
  });

  it("conserve un élément ajouté à la main sur ce concours, à la suite", () => {
    const current = [
      { id: "x1", label: "Casque", checked: false },
      { id: "perso", label: "Apporter le trophée", checked: true },
    ];
    const result = applyChecklistTemplate(current, previous, ["Casque", "Bottes"], counter());
    expect(result.map((i) => i.label)).toEqual(["Casque", "Bottes", "Apporter le trophée"]);
    expect(result[2]).toEqual({ id: "perso", label: "Apporter le trophée", checked: true });
  });

  it("compare sans tenir compte de la casse", () => {
    const current = [{ id: "x1", label: "casque", checked: true }];
    const result = applyChecklistTemplate(current, previous, ["Casque"], counter());
    expect(result).toEqual([{ id: "x1", label: "casque", checked: true }]);
  });

  it("appliquée deux fois de suite, ne change plus rien", () => {
    const current = [{ id: "x1", label: "Casque", checked: true }];
    const once = applyChecklistTemplate(current, previous, ["Casque", "Bottes"], counter());
    const twice = applyChecklistTemplate(once, ["Casque", "Bottes"], ["Casque", "Bottes"], counter());
    expect(twice).toEqual(once);
  });

  it("une liste type vide vide la checklist des éléments de l'ancienne liste seulement", () => {
    const current = [
      { id: "x1", label: "Casque", checked: false },
      { id: "perso", label: "Perso", checked: false },
    ];
    expect(applyChecklistTemplate(current, previous, [], counter())).toEqual([
      { id: "perso", label: "Perso", checked: false },
    ]);
  });
});
