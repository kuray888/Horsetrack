import { describe, expect, it } from "vitest";
import { hashToUnit, pickVariant } from "./experimentsLogic";

describe("hashToUnit", () => {
  it("reste dans [0, 1) et ne change pas d'un appel à l'autre", () => {
    for (const s of ["", "a", "paywall:1234", "é🐴"]) {
      const v = hashToUnit(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(hashToUnit(s)).toBe(v);
    }
  });
});

describe("pickVariant", () => {
  const ids = Array.from({ length: 4000 }, (_, i) => `appareil-${i}`);

  it("donne toujours la même variante au même appareil", () => {
    expect(pickVariant("exp", "abc", ["a", "b"])).toBe(pickVariant("exp", "abc", ["a", "b"]));
  });

  it("répartit à peu près à parts égales", () => {
    const a = ids.filter((id) => pickVariant("exp", id, ["a", "b"]) === "a").length;
    expect(a / ids.length).toBeGreaterThan(0.45);
    expect(a / ids.length).toBeLessThan(0.55);
  });

  it("respecte les poids", () => {
    const a = ids.filter((id) => pickVariant("exp", id, ["a", "b"], [9, 1]) === "a").length;
    expect(a / ids.length).toBeGreaterThan(0.86);
    expect(a / ids.length).toBeLessThan(0.94);
  });

  it("un poids nul exclut la variante", () => {
    expect(ids.some((id) => pickVariant("exp", id, ["a", "b"], [1, 0]) === "b")).toBe(false);
  });

  it("des poids invalides retombent sur des parts égales", () => {
    for (const w of [[1], [-1, 2], [0, 0]]) {
      const a = ids.filter((id) => pickVariant("exp", id, ["a", "b"], w) === "a").length;
      expect(a / ids.length).toBeGreaterThan(0.45);
      expect(a / ids.length).toBeLessThan(0.55);
    }
  });

  it("deux expériences ne coupent pas la population au même endroit", () => {
    const same = ids.filter((id) => pickVariant("x", id, ["a", "b"]) === pickVariant("y", id, ["a", "b"])).length;
    expect(same / ids.length).toBeGreaterThan(0.4);
    expect(same / ids.length).toBeLessThan(0.6);
  });
});
