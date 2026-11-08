/**
 * Source de vérité UNIQUE du design system Horsetrack.
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
  textMuted: "#6a6b68", // texte secondaire / labels (stone assombri : 4,5:1 sur le fond)
  textOnPrimary: "#ffffff", // texte sur fond primary
  border: "#d7dfe4", // bordures discrètes

  // États fonctionnels
  success: "#2b744f",
  warning: "#935c1a",
  danger: "#ab4a38",
};

module.exports = { palette, colors };
