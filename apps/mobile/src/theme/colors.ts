/**
 * Accès JS aux couleurs Horsetrack, pour les cas non stylables en className
 * (ex: props de couleur de react-native-svg, valeurs dynamiques en TS).
 *
 * La source de vérité est `tokens.cjs` (partagée avec tailwind.config.js).
 * Pour styler de l'UI, préfère TOUJOURS les classes Tailwind (bg-primary, text-muted…).
 */
import { colors as tokenColors } from "./tokens.cjs";

export const colors = {
  ...tokenColors,

  // Couleurs par type d'événement "À venir" (mappées sur la palette) — partagées
  // entre Today (liste fusionnée séances + rendez-vous) et Agenda.
  event: {
    seance: tokenColors.primary,
    veto: tokenColors.warning,
    osteo: tokenColors.accent,
    marechal: tokenColors.primary,
    dentiste: tokenColors.success,
    vaccination: tokenColors.success,
    vermifuge: tokenColors.warning,
    traitement: tokenColors.primary,
    concours: tokenColors.accent,
    autre: tokenColors.textMuted,
  },
};
