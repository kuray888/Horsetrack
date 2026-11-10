import { describe, expect, it } from "vitest";
import { chipIconKind } from "./chipIcon";

const glyphs = { "horse-variant": 1, walk: 2 };

describe("chipIconKind", () => {
  it("un nom d'icône connu se dessine, il ne s'écrit pas", () => {
    expect(chipIconKind("horse-variant", glyphs)).toBe("glyph");
    expect(chipIconKind("walk", glyphs)).toBe("glyph");
  });
  it("un emoji reste du texte", () => {
    expect(chipIconKind("🙂", glyphs)).toBe("emoji");
    expect(chipIconKind("", glyphs)).toBe("emoji");
  });
  it("ne confond pas avec les propriétés de l'objet", () => {
    expect(chipIconKind("toString", glyphs)).toBe("emoji");
  });
});
