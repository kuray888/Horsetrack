import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { Appearance, View, useColorScheme } from "react-native";
import { vars } from "nativewind";
import * as SecureStore from "expo-secure-store";
import {
  PALETTES,
  STATUS_COLORS,
  cssVarsForTheme,
  paletteFor,
  DEFAULT_THEME,
  type ColorScheme,
  type ThemeId,
  type ThemeColors,
} from "./palettes";

function colorsForTheme(id: ThemeId, scheme: ColorScheme): ThemeColors {
  return { ...paletteFor(id, scheme), ...STATUS_COLORS };
}

const KEY = "theme_id_v1";
const APPEARANCE_KEY = "appearance_v1";

/** Choix de l'utilisateur (Profil → Apparence). « system » suit le réglage
 * Clair/Sombre de l'iPhone, y compris son passage automatique le soir. */
export type AppearancePreference = "system" | "light" | "dark";

type ThemeContextValue = {
  themeId: ThemeId;
  colors: ThemeColors;
  setThemeId: (id: ThemeId) => void;
  /** Mode effectivement affiché. */
  scheme: ColorScheme;
  appearance: AppearancePreference;
  setAppearance: (pref: AppearancePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Racine du thème — enveloppe toute l'app (cf. app/_layout.tsx) dans une
 * `View` porteuse des variables CSS de la palette choisie (`vars()`,
 * NativeWind v4) : toute classe Tailwind sémantique (bg-primary, text-accent,
 * border-border…) descendante suit la palette en direct, sans recompilation.
 * Persisté en SecureStore, comme le verrou biométrique.
 *
 * Mode sombre : chaque palette a sa variante sombre (cf. DARK_PALETTES). Un
 * choix forcé (Clair ou Sombre) est aussi transmis au système
 * (`Appearance.setColorScheme`), pour que le clavier, les alertes et les
 * sélecteurs natifs suivent l'app plutôt que le réglage de l'iPhone.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME);
  const [appearance, setAppearanceState] = useState<AppearancePreference>("system");
  const systemScheme = useColorScheme();

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((raw) => {
        if (raw && raw in PALETTES) setThemeIdState(raw as ThemeId);
      })
      .catch((e) => console.warn("[theme] lecture SecureStore échouée, thème par défaut", e));
    SecureStore.getItemAsync(APPEARANCE_KEY)
      .then((raw) => {
        if (raw === "light" || raw === "dark") setAppearanceState(raw);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      Appearance.setColorScheme(appearance === "system" ? "unspecified" : appearance);
    } catch {
      // Best-effort : sans effet, seuls les éléments natifs suivraient
      // l'iPhone au lieu de l'app.
    }
  }, [appearance]);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    SecureStore.setItemAsync(KEY, id).catch(() => {});
  }, []);

  const setAppearance = useCallback((pref: AppearancePreference) => {
    setAppearanceState(pref);
    SecureStore.setItemAsync(APPEARANCE_KEY, pref).catch(() => {});
  }, []);

  // Choix forcé : appliqué tel quel, sans attendre que le système relaie
  // `setColorScheme` (sinon une image en clair passerait entre les deux).
  const scheme: ColorScheme = appearance === "system" ? (systemScheme === "dark" ? "dark" : "light") : appearance;

  const value = useMemo<ThemeContextValue>(
    () => ({ themeId, colors: colorsForTheme(themeId, scheme), setThemeId, scheme, appearance, setAppearance }),
    [themeId, scheme, setThemeId, appearance, setAppearance]
  );

  const themeVars = useMemo(() => vars(cssVarsForTheme(themeId, scheme)), [themeId, scheme]);

  return (
    <ThemeContext.Provider value={value}>
      <View style={[themeVars, { backgroundColor: value.colors.background }]} className="flex-1">
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme doit être utilisé dans <ThemeProvider>");
  return ctx;
}

/** Accès JS aux couleurs de la palette active — pour les cas non stylables
 * en className (icônes, react-native-svg…), équivalent réactif de l'ancien
 * export statique `colors` de theme/colors.ts. */
export function useThemeColors(): ThemeColors {
  return useTheme().colors;
}

/** Comme useThemeColors, sans exiger le fournisseur : pour les composants
 * de base (icônes) aussi rendus hors thème (écran de plantage). */
export function useOptionalThemeColors(): ThemeColors | null {
  return useContext(ThemeContext)?.colors ?? null;
}
