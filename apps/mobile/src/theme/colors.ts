/**
 * Accès JS aux couleurs Cheval, pour les cas non stylables en className
 * (ex: props de couleur de react-native-svg, valeurs dynamiques en TS).
 *
 * La source de vérité est `tokens.cjs` (partagée avec tailwind.config.js).
 * Pour styler de l'UI, préfère TOUJOURS les classes Tailwind (bg-primary, text-muted…).
 */
import { colors as tokenColors } from "./tokens.cjs";

export const colors = {
  ...tokenColors,

  // Couleurs par type d'événement "À venir" (mappées sur la palette)
  event: {
    seance: tokenColors.primary,
    veto: tokenColors.warning,
    competition: tokenColors.accent,
  },
};
