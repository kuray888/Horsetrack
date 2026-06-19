/**
 * Source de vérité UNIQUE du design system Cheval.
 * Consommé à la fois par `tailwind.config.js` (classes utilitaires) et par
 * `src/theme/colors.ts` (accès JS pour les cas non stylables en className,
 * ex: les props de couleur de react-native-svg).
 *
 * Changer une couleur ici => répercuté partout (className ET code JS).
 * CommonJS car tailwind.config.js tourne sous Node (pas de transpile TS).
 */

// Palette de marque brute
const palette = {
  navy: "#274c77",
  blue: "#6096ba",
  sky: "#a3cef1",
  mist: "#e7ecef",
  stone: "#8b8c89",
};

const colors = {
  ...palette,

  // Rôles sémantiques
  primary: palette.navy, // titres, actions principales, anneau de progression
  accent: palette.blue, // éléments secondaires, liens, icônes actives
  highlight: palette.sky, // fonds légers, états sélectionnés
  background: palette.mist, // fond d'écran
  surface: "#ffffff", // cartes

  // Texte
  text: palette.navy, // texte fort
  textMuted: palette.stone, // texte secondaire / labels
  textOnPrimary: "#ffffff", // texte sur fond primary
  border: "#d7dfe4", // bordures discrètes

  // États fonctionnels
  success: "#3a9d6b",
  warning: "#d98a2b",
  danger: "#c0533f",
};

module.exports = { palette, colors };
