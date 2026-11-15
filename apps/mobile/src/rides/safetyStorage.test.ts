import { describe, expect, it } from "vitest";
import { safetyKeyForUser, shouldAdoptLegacySafety, SAFETY_LEGACY_KEY } from "./safetyStorage";

describe("rangement des proches par compte", () => {
  it("un fichier par compte, distinct de l'ancien", () => {
    expect(safetyKeyForUser("lea")).not.toBe(safetyKeyForUser("marie"));
    expect(safetyKeyForUser("lea")).not.toBe(SAFETY_LEGACY_KEY);
  });
  it("les anciens réglages ne vont qu'au propriétaire des données de l'appareil", () => {
    expect(shouldAdoptLegacySafety("lea", "lea")).toBe(true);
    expect(shouldAdoptLegacySafety("marie", "lea")).toBe(false);
    expect(shouldAdoptLegacySafety("marie", null)).toBe(false);
    expect(shouldAdoptLegacySafety(null, "lea")).toBe(false);
  });
});
