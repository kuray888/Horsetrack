import type { Gait } from "@/rides/rideMath";

/** Couleurs du thème utilisées pour les allures. */
type GaitPalette = { border: string; success: string; accent: string; primary: string };

/** Couleur de chaque allure sur le tracé : les mêmes que la barre des allures
 * (GaitBreakdown) et la relecture de séance, pour qu'une couleur veuille dire
 * la même chose partout. */
export function gaitColorsFor(colors: GaitPalette): Record<Gait, string> {
  return { halt: colors.border, walk: colors.success, trot: colors.accent, canter: colors.primary };
}
