import { t } from "@/i18n";

/**
 * Palettes de couleur prédéfinies — choix dans Profil → Apparence, cf.
 * ThemeProvider.tsx. Chaque palette redéfinit les 9 rôles sémantiques
 * "de marque" (primary/accent/highlight/background/surface/text/textMuted/
 * textOnPrimary/border) ; success/warning/danger restent volontairement
 * identiques dans toutes les palettes (le rouge d'alerte ne doit pas changer
 * de sens juste parce que le thème change) — seule leur luminosité suit le
 * mode, cf. statusColorsFor.
 *
 * Limite connue : seules les classes Tailwind (bg-primary, text-accent…)
 * suivent le thème en direct, via les variables CSS injectées par
 * ThemeProvider. Les teintes d'icônes définies dans les *_META à portée de
 * module (ex: EXPENSE_META dans agenda/meta.ts) restent figées sur la palette
 * Marine — accents secondaires/décoratifs, pas la couleur de marque
 * perçue de l'app.
 */
export type ThemeId = "marine" | "bordeaux" | "paturage" | "ardoise" | "coucher-de-soleil" | "lavande";

/** Les 9 rôles qui varient réellement d'une palette à l'autre. */
export type PaletteColors = {
  primary: string;
  accent: string;
  highlight: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  textOnPrimary: string;
  border: string;
};

/** Forme complète retournée par useThemeColors() : palette active +
 * success/warning/danger (constants entre toutes les palettes, cf.
 * STATUS_COLORS plus bas) — une API à un seul objet, comme l'ancien export
 * statique `colors` de theme/colors.ts. */
export type ThemeColors = PaletteColors & {
  success: string;
  warning: string;
  danger: string;
  /** Texte ou icône posé SUR une couleur d'état (coche d'une séance faite,
   * « Supprimer » du balayage) : blanc en clair, presque noir en sombre. */
  textOnStatus: string;
};

export const THEME_ORDER: ThemeId[] = ["marine", "bordeaux", "paturage", "ardoise", "coucher-de-soleil", "lavande"];

export const THEME_LABELS: Record<ThemeId, string> = {
  marine: t("Marine"),
  bordeaux: t("Bordeaux"),
  paturage: t("Pâturage"),
  ardoise: t("Ardoise"),
  "coucher-de-soleil": t("Coucher de soleil"),
  lavande: t("Lavande"),
};

export const PALETTES: Record<ThemeId, PaletteColors> = {
  marine: {
    primary: "#274c77",
    accent: "#6096ba",
    highlight: "#a3cef1",
    background: "#e7ecef",
    surface: "#ffffff",
    text: "#274c77",
    textMuted: "#6a6b68",
    textOnPrimary: "#ffffff",
    border: "#d7dfe4",
  },
  bordeaux: {
    primary: "#6b2737",
    accent: "#b5495b",
    highlight: "#f0dbe0",
    background: "#f7eef0",
    surface: "#ffffff",
    text: "#4a1c28",
    textMuted: "#7e676c",
    textOnPrimary: "#ffffff",
    border: "#e8d5d9",
  },
  paturage: {
    primary: "#2f5233",
    accent: "#6b9b5e",
    highlight: "#d9e8cf",
    background: "#eef3e9",
    surface: "#ffffff",
    text: "#24391f",
    textMuted: "#677160",
    textOnPrimary: "#ffffff",
    border: "#dbe5d3",
  },
  ardoise: {
    primary: "#2e3440",
    accent: "#5e7ba0",
    highlight: "#dbe3ec",
    background: "#eceff3",
    surface: "#ffffff",
    text: "#232830",
    textMuted: "#656d79",
    textOnPrimary: "#ffffff",
    border: "#dde2e8",
  },
  "coucher-de-soleil": {
    primary: "#b5502e",
    accent: "#e0925a",
    highlight: "#fbe3d1",
    background: "#fbf1e8",
    surface: "#ffffff",
    text: "#5c2c17",
    textMuted: "#7e6b5c",
    textOnPrimary: "#ffffff",
    border: "#f0ded0",
  },
  lavande: {
    primary: "#5b4b8a",
    accent: "#9583c9",
    highlight: "#e6def5",
    background: "#f4f1fa",
    surface: "#ffffff",
    text: "#362a54",
    textMuted: "#736890",
    textOnPrimary: "#ffffff",
    border: "#e3ddf0",
  },
};

/**
 * Variantes sombres, une par palette. Mêmes rôles, mêmes teintes : le
 * cavalier qui a choisi « Bordeaux » le retrouve la nuit.
 *
 * `primary` y est plus clair qu'en mode clair : il sert à la fois de fond
 * (boutons, en-tête de l'Accueil, avec du texte blanc) et de couleur de texte
 * (liens, titres) sur une surface foncée — la teinte claire d'origine serait
 * illisible sur fond sombre, la teinte foncée d'origine aussi. Le texte
 * principal, lui, devient un blanc légèrement teinté. Les deux usages
 * s'opposent (4,5:1 des deux côtés est impossible) : chaque `primary` est
 * placé au point d'équilibre, environ 4:1 pour le texte blanc dessus comme
 * pour lui-même sur une carte sombre.
 */
export const DARK_PALETTES: Record<ThemeId, PaletteColors> = {
  marine: {
    primary: "#4a82bd",
    accent: "#7fb0d4",
    highlight: "#172b43",
    background: "#0e1621",
    surface: "#18222f",
    text: "#e6edf4",
    textMuted: "#8f9bab",
    textOnPrimary: "#ffffff",
    border: "#2a3646",
  },
  bordeaux: {
    primary: "#bd5e76",
    accent: "#d4778a",
    highlight: "#3a1f27",
    background: "#160e11",
    surface: "#22171b",
    text: "#f3e6e9",
    textMuted: "#a8949a",
    textOnPrimary: "#ffffff",
    border: "#3a2a2f",
  },
  paturage: {
    primary: "#4c8c54",
    accent: "#8fbf80",
    highlight: "#1f3322",
    background: "#0e140e",
    surface: "#182118",
    text: "#e5efe1",
    textMuted: "#92a08b",
    textOnPrimary: "#ffffff",
    border: "#2b3a2b",
  },
  ardoise: {
    primary: "#6c7e9a",
    accent: "#8aa6cc",
    highlight: "#232c39",
    background: "#0f1115",
    surface: "#1a1d23",
    text: "#e6e9ee",
    textMuted: "#8f97a3",
    textOnPrimary: "#ffffff",
    border: "#2c313a",
  },
  "coucher-de-soleil": {
    primary: "#c85d33",
    accent: "#eba876",
    highlight: "#3a2216",
    background: "#17100b",
    surface: "#241912",
    text: "#f6e8de",
    textMuted: "#ab9584",
    textOnPrimary: "#ffffff",
    border: "#3d2c21",
  },
  lavande: {
    primary: "#8270c0",
    accent: "#ad9ee0",
    highlight: "#2a2340",
    background: "#110f18",
    surface: "#1c1926",
    text: "#ece8f6",
    textMuted: "#9b92b3",
    textOnPrimary: "#ffffff",
    border: "#322c45",
  },
};

export type ColorScheme = "light" | "dark";

export function paletteFor(id: ThemeId, scheme: ColorScheme): PaletteColors {
  return scheme === "dark" ? DARK_PALETTES[id] : PALETTES[id];
}

/** success/warning/danger : constants, cf. commentaire de tête. */
/** Couleurs d'état. Elles gardent leur sens dans toutes les palettes, mais
 * changent de luminosité avec le mode : surtout utilisées en texte (badges
 * sur fond /15, montants, alertes), elles visent 4,5:1 en clair ; en sombre,
 * plus claires, elles équilibrent texte sur carte sombre et icône blanche
 * sur fond plein (case cochée). Garder en phase avec tokens.cjs (mode clair). */
export const STATUS_COLORS = {
  success: "#2b744f",
  warning: "#935c1a",
  danger: "#ab4a38",
};

export const DARK_STATUS_COLORS: typeof STATUS_COLORS = {
  success: "#3faa74",
  warning: "#d48526",
  danger: "#d18274",
};

export function statusColorsFor(scheme: ColorScheme): typeof STATUS_COLORS {
  return scheme === "dark" ? DARK_STATUS_COLORS : STATUS_COLORS;
}

/** Couleur du texte posé sur success/warning/danger. En sombre, ces couleurs
 * sont éclaircies pour rester lisibles sur fond foncé : le blanc n'y faisait
 * plus que 2,9:1 (coche d'une séance faite, balayage « Supprimer »). */
export function onStatusColorFor(scheme: ColorScheme): string {
  return scheme === "dark" ? "#111418" : "#ffffff";
}

export const DEFAULT_THEME: ThemeId = "marine";

function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  // Séparateur virgule, pas espace : tailwind.config.js compose
  // `rgba(var(--x), opacity)` pour les classes avec opacité (bg-primary/15…)
  // — `rgba(39 76 119, 0.5)` (espaces) n'est pas du CSS valide, seul
  // `rgba(39, 76, 119, 0.5)` (tout en virgules) l'est.
  return `${r}, ${g}, ${b}`;
}

/** Construit l'objet de variables CSS (format "R, G, B" attendu par les
 * classes Tailwind `rgba(var(--x), opacity)` / `rgb(var(--x))`, cf.
 * tailwind.config.js) pour une palette donnée — consommé par ThemeProvider
 * via `vars()`. */
export function cssVarsForTheme(id: ThemeId, scheme: ColorScheme = "light"): Record<string, string> {
  const p = paletteFor(id, scheme);
  const status = statusColorsFor(scheme);
  return {
    "--color-primary": hexToRgbTriplet(p.primary),
    "--color-accent": hexToRgbTriplet(p.accent),
    "--color-highlight": hexToRgbTriplet(p.highlight),
    "--color-background": hexToRgbTriplet(p.background),
    "--color-surface": hexToRgbTriplet(p.surface),
    "--color-text": hexToRgbTriplet(p.text),
    "--color-text-muted": hexToRgbTriplet(p.textMuted),
    "--color-text-on-primary": hexToRgbTriplet(p.textOnPrimary),
    "--color-border": hexToRgbTriplet(p.border),
    "--color-success": hexToRgbTriplet(status.success),
    "--color-warning": hexToRgbTriplet(status.warning),
    "--color-danger": hexToRgbTriplet(status.danger),
    "--color-text-on-status": hexToRgbTriplet(onStatusColorFor(scheme)),
  };
}
