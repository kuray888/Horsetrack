import { describe, it, expect } from "vitest";
import { DARK_PALETTES, PALETTES, THEME_ORDER, cssVarsForTheme } from "./palettes";

function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("palettes", () => {
  for (const [mode, palettes] of [["clair", PALETTES], ["sombre", DARK_PALETTES]] as const) {
    for (const id of THEME_ORDER) {
      it(`${id} (${mode}) reste lisible`, () => {
        const p = palettes[id];
        // Texte courant : AA (4,5:1) sur le fond et sur les cartes.
        expect(contrast(p.text, p.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.text, p.surface)).toBeGreaterThanOrEqual(4.5);
        // Texte sur bouton principal (gras) : 3:1 au minimum.
        expect(contrast(p.textOnPrimary, p.primary)).toBeGreaterThanOrEqual(3);
        // Libellés secondaires sur carte.
        expect(contrast(p.textMuted, p.surface)).toBeGreaterThanOrEqual(2.5);
      });
    }
  }

  it("le mode sombre a une vraie surface sombre", () => {
    for (const id of THEME_ORDER) expect(luminance(DARK_PALETTES[id].surface)).toBeLessThan(0.05);
  });

  it("produit les variables CSS du mode demandé", () => {
    expect(cssVarsForTheme("marine", "dark")["--color-background"]).toBe("14, 22, 33");
    expect(cssVarsForTheme("marine")["--color-background"]).toBe("231, 236, 239");
  });
});
