import type { ComponentProps } from "react";
import { MaterialCommunityIcons as BaseIcons } from "@expo/vector-icons";
import { colors as staticColors } from "@/theme/colors";
import { useOptionalThemeColors } from "@/theme/ThemeProvider";
import type { ThemeColors } from "@/theme/palettes";

type IconProps = ComponentProps<typeof BaseIcons>;

/** Couleurs « Marine claire » figées dans les tables de catégories
 * (ACTIVITY_META, APPT_META, EXPENSE_META…, évaluées une fois au chargement)
 * → rôle correspondant de la palette active. */
const STATIC_ROLES: [string, keyof ThemeColors][] = [
  [staticColors.primary, "primary"],
  [staticColors.accent, "accent"],
  [staticColors.highlight, "highlight"],
  [staticColors.textMuted, "textMuted"],
  [staticColors.border, "border"],
];

function themedColor(color: IconProps["color"], theme: ThemeColors | null): IconProps["color"] {
  if (!theme || typeof color !== "string") return color;
  const lower = color.toLowerCase();
  for (const [hex, role] of STATIC_ROLES) {
    if (hex.toLowerCase() === lower) return theme[role];
  }
  return color;
}

/**
 * Icône Material, identique à celle de @expo/vector-icons, mais dont la
 * couleur suit le thème actif.
 *
 * Les tables de catégories fixent leurs couleurs une fois pour toutes, sur la
 * palette Marine claire : en mode sombre, ce bleu marine devenait illisible
 * sur fond foncé, et avec les autres palettes ces icônes restaient bleues
 * (limite notée dans theme/palettes.ts). Plutôt que de modifier chacun des
 * écrans qui les affichent, la conversion se fait ici, à l'affichage. Une
 * couleur déjà issue du thème, ou propre (blanc sur photo, statut), passe
 * telle quelle.
 */
function ThemedMaterialCommunityIcons(props: IconProps) {
  const theme = useOptionalThemeColors();
  return <BaseIcons {...props} color={themedColor(props.color, theme)} />;
}

export const MaterialCommunityIcons = Object.assign(ThemedMaterialCommunityIcons, {
  glyphMap: BaseIcons.glyphMap,
});
