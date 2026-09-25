import { describe, expect, it } from "vitest";
import { NO_HEALTH_CONDITION } from "@/onboarding/options";
import { healthConditionsState, knownHealthConditions, toggleHealthCondition } from "./healthConditions";

describe("toggleHealthCondition", () => {
  it("ajoute puis retire une condition", () => {
    const added = toggleHealthCondition([], "Arthrose");
    expect(added).toEqual(["Arthrose"]);
    expect(toggleHealthCondition(added, "Arthrose")).toEqual([]);
  });

  it("retire 'Aucun problème connu' dès qu'une vraie condition est cochée", () => {
    expect(toggleHealthCondition([NO_HEALTH_CONDITION], "Fourbure")).toEqual(["Fourbure"]);
  });

  it("efface toutes les conditions quand on coche 'Aucun problème connu'", () => {
    expect(toggleHealthCondition(["Arthrose", "Fourbure"], NO_HEALTH_CONDITION)).toEqual([NO_HEALTH_CONDITION]);
  });

  it("décoche 'Aucun problème connu' s'il était déjà coché", () => {
    expect(toggleHealthCondition([NO_HEALTH_CONDITION], NO_HEALTH_CONDITION)).toEqual([]);
  });

  it("accepte une condition saisie librement", () => {
    expect(toggleHealthCondition(["Arthrose"], "Sarcoïdes")).toEqual(["Arthrose", "Sarcoïdes"]);
  });
});

describe("healthConditionsState", () => {
  it("distingue 'renseigné', 'aucun problème connu' et 'jamais renseigné'", () => {
    expect(healthConditionsState(["Arthrose"])).toBe("listed");
    expect(healthConditionsState([NO_HEALTH_CONDITION])).toBe("none");
    expect(healthConditionsState([])).toBe("unknown");
  });

  it("knownHealthConditions exclut la valeur sentinelle", () => {
    expect(knownHealthConditions([NO_HEALTH_CONDITION, "Arthrose"])).toEqual(["Arthrose"]);
  });
});
