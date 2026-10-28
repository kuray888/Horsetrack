import { describe, expect, it } from "vitest";
import {
  EXTRA_ACTIVITIES,
  LEGACY_ACTIVITIES,
  activityFromServer,
  activityToServer,
  isRestActivity,
  mergeActivityType,
} from "@/agenda/activityKinds";

describe("types de séance côté serveur", () => {
  it("un type d'origine s'écrit comme avant, sans type précis", () => {
    expect(activityToServer("dressage")).toEqual({ activityType: "DRESSAGE", activityKind: null });
  });

  it("un nouveau type garde un type de base lisible par les anciennes versions", () => {
    expect(activityToServer("travail_a_pied")).toEqual({ activityType: "LONGE", activityKind: "travail_a_pied" });
    expect(activityToServer("cross")).toEqual({ activityType: "CSO", activityKind: "cross" });
    expect(activityToServer("pansage")).toEqual({ activityType: "REPOS", activityKind: "pansage" });
    for (const kind of EXTRA_ACTIVITIES) {
      expect(LEGACY_ACTIVITIES).toContain(activityToServer(kind).activityType.toLowerCase());
    }
  });

  it("relit le type précis, ou le type de base, ou un défaut sûr", () => {
    expect(activityFromServer("LONGE", "travail_a_pied")).toBe("travail_a_pied");
    expect(activityFromServer("CSO", null)).toBe("cso");
    expect(activityFromServer("CSO", "type_futur")).toBe("cso");
    expect(activityFromServer("INCONNU", undefined)).toBe("balade");
  });

  it("aller-retour sans perte pour tous les types", () => {
    for (const kind of [...LEGACY_ACTIVITIES, ...EXTRA_ACTIVITIES]) {
      const s = activityToServer(kind);
      expect(activityFromServer(s.activityType, s.activityKind)).toBe(kind);
    }
  });

  it("le pansage compte comme un jour sans travail, comme le repos", () => {
    expect(isRestActivity("pansage")).toBe(true);
    expect(isRestActivity("repos")).toBe(true);
    expect(isRestActivity("trec")).toBe(false);
  });

  it("ignore un type précis périmé, laissé par une ancienne version de l'app", () => {
    // Un « TREC » passé en « Dressage » depuis une version qui n'écrit pas
    // activityKind : la colonne garde « trec », le type de base fait foi.
    expect(activityFromServer("DRESSAGE", "trec")).toBe("dressage");
    expect(activityFromServer("BALADE", "trec")).toBe("trec");
  });
});

describe("type précis et SQL pas encore exécuté", () => {
  it("colonne absente : le type précis local est gardé, sans renvoi inutile", () => {
    expect(mergeActivityType("trec", "balade", "missing")).toEqual({ type: "trec", resend: false });
  });

  it("colonne tout juste créée : le type précis est gardé et renvoyé", () => {
    expect(mergeActivityType("travail_a_pied", "longe", "catching_up")).toEqual({ type: "travail_a_pied", resend: true });
  });

  it("le serveur fait foi dès que la colonne est là, ou si le type de base a changé", () => {
    expect(mergeActivityType("trec", "balade", "present")).toEqual({ type: "balade", resend: false });
    expect(mergeActivityType("trec", "dressage", "missing")).toEqual({ type: "dressage", resend: false });
    expect(mergeActivityType("trec", "dressage", "catching_up")).toEqual({ type: "dressage", resend: false });
    expect(mergeActivityType("balade", "balade", "catching_up")).toEqual({ type: "balade", resend: false });
    expect(mergeActivityType("cross", "endurance", "catching_up")).toEqual({ type: "endurance", resend: false });
  });
});
