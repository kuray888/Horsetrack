/**
 * Couleurs sémantiques pilotées par variables CSS (cf. src/theme/palettes.ts
 * + ThemeProvider.tsx, qui les injecte via `vars()` NativeWind) : chaque
 * palette choisie dans Profil → Apparence redéfinit ces variables, donc
 * chaque classe ci-dessous (bg-primary, text-accent…) suit le thème actif en
 * direct, sans recompilation. Format Tailwind standard "opacité + variable
 * RGB" — la variable stocke "R, G, B" (virgules : `rgba(var(--x), 0.5)`
 * n'est du CSS valide qu'avec des composantes séparées par des virgules, pas
 * des espaces), cf. cssVarsForTheme.
 */
function themed(varName) {
  return ({ opacityValue }) =>
    opacityValue !== undefined ? `rgba(var(${varName}), ${opacityValue})` : `rgb(var(${varName}))`;
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: themed("--color-primary"),
        accent: themed("--color-accent"),
        highlight: themed("--color-highlight"),
        background: themed("--color-background"),
        surface: themed("--color-surface"),
        text: themed("--color-text"),
        textMuted: themed("--color-text-muted"),
        textOnPrimary: themed("--color-text-on-primary"),
        border: themed("--color-border"),
        success: themed("--color-success"),
        warning: themed("--color-warning"),
        danger: themed("--color-danger"),
        // alias kebab-case pour les classes (text-muted, text-on-primary…)
        muted: themed("--color-text-muted"),
        "on-primary": themed("--color-text-on-primary"),
      },
      // Police d'affichage (titres d'écran, en-têtes de section, titre du
      // paywall) — chargée dans app/_layout.tsx (useFonts). Volontairement
      // limitée aux titres plutôt qu'appliquée partout : le corps de texte
      // reste sur la police système (SF Pro/Roboto), déjà parfaitement
      // lisible et gratuite en poids de bundle — cf. plan refonte visuelle.
      fontFamily: {
        display: ["BricolageGrotesque_800ExtraBold"],
        "display-bold": ["BricolageGrotesque_700Bold"],
      },
      borderRadius: {
        card: "20px",
      },
      boxShadow: {
        // Ombre de carte neutre — pas pilotée par le thème (les shadows RN ne
        // suivent pas les variables CSS comme les couleurs de fond/texte),
        // volontairement discrète (opacité 8%) pour rester correcte quelle
        // que soit la palette active.
        card: "0px 4px 12px rgba(20, 20, 30, 0.08)",
      },
    },
  },
  plugins: [],
};
