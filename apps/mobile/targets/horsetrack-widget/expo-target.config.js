/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: "widget",
  displayName: "Horsetrack Widget",
  deploymentTarget: "17.0",
  frameworks: ["WidgetKit", "SwiftUI"],
  entitlements: {
    "com.apple.security.application-groups": ["group.com.horsetrack.app"],
  },
  // Couleurs de la marque (palette « marine » par défaut, cf.
  // src/theme/palettes.ts) : sans elles, le widget retombait sur le bleu
  // système. `$accent` = couleur d'accent globale de la cible (Color.accentColor).
  colors: {
    $accent: { light: "#274c77", dark: "#7fb0d4" },
    $widgetBackground: { light: "#ffffff", dark: "#0e1621" },
  },
};
