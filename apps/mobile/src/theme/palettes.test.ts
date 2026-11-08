import { describe, it, expect } from "vitest";
import { DARK_PALETTES, PALETTES, THEME_ORDER, cssVarsForTheme, statusColorsFor } from "./palettes";

function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Couleur `fg` à l'opacité `alpha` posée sur `bg` (classes bg-success/15…). */
function over(fg: string, bg: string, alpha: number): string {
  const ch = (h: string, i: number) => parseInt(h.replace("#", "").slice(i, i + 2), 16);
  return "#" + [0, 2, 4].map((i) => Math.round(ch(fg, i) * alpha + ch(bg, i) * (1 - alpha)).toString(16).padStart(2, "0")).join("");
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
        // Libellés secondaires : AA aussi.
        expect(contrast(p.textMuted, p.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.textMuted, p.surface)).toBeGreaterThanOrEqual(4.5);
        // Texte blanc sur bouton principal : AA en clair ; en sombre, primary
        // sert aussi de texte sur carte, les deux sont équilibrés vers 4:1.
        const min = mode === "clair" ? 4.5 : 3.9;
        expect(contrast(p.textOnPrimary, p.primary)).toBeGreaterThanOrEqual(min);
        if (mode === "sombre") expect(contrast(p.primary, p.surface)).toBeGreaterThanOrEqual(min);
        // Badges : texte d'état sur son fond /15.
        const status = statusColorsFor(mode === "clair" ? "light" : "dark");
        for (const c of Object.values(status)) {
          expect(contrast(c, over(c, p.surface, 0.15))).toBeGreaterThanOrEqual(mode === "clair" ? 4.5 : 4.3);
        }
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
