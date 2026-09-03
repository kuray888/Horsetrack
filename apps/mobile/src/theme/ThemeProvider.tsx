import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { View } from "react-native";
import { vars } from "nativewind";
import * as SecureStore from "expo-secure-store";
import { PALETTES, STATUS_COLORS, cssVarsForTheme, DEFAULT_THEME, type ThemeId, type ThemeColors } from "./palettes";

function colorsForTheme(id: ThemeId): ThemeColors {
  return { ...PALETTES[id], ...STATUS_COLORS };
}

const KEY = "theme_id_v1";

type ThemeContextValue = {
  themeId: ThemeId;
  colors: ThemeColors;
  setThemeId: (id: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Racine du thème — enveloppe toute l'app (cf. app/_layout.tsx) dans une
 * `View` porteuse des variables CSS de la palette choisie (`vars()`,
 * NativeWind v4) : toute classe Tailwind sémantique (bg-primary, text-accent,
 * border-border…) descendante suit la palette en direct, sans recompilation.
 * Persisté en SecureStore, comme le verrou biométrique.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    SecureStore.getItemAsync(KEY).then((raw) => {
      if (raw && raw in PALETTES) setThemeIdState(raw as ThemeId);
    });
  }, []);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    SecureStore.setItemAsync(KEY, id).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ themeId, colors: colorsForTheme(themeId), setThemeId }),
    [themeId, setThemeId]
  );

  const themeVars = useMemo(() => vars(cssVarsForTheme(themeId)), [themeId]);

  return (
    <ThemeContext.Provider value={value}>
      <View style={themeVars} className="flex-1">
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
