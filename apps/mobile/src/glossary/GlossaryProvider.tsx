import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { lookupGlossaryTerm } from "./terms";

type GlossaryContextValue = { activeTerm: string | null; showTerm: (term: string) => void; hide: () => void };

const GlossaryContext = createContext<GlossaryContextValue | null>(null);

/** À utiliser via GlossaryText (pour déclencher) et GlossaryPopup (pour afficher) —
 * cf. _layout.tsx pour le provider. */
export function useGlossary(): GlossaryContextValue {
  const ctx = useContext(GlossaryContext);
  if (!ctx) throw new Error("useGlossary doit être utilisé sous GlossaryProvider");
  return ctx;
}

export function GlossaryProvider({ children }: { children: ReactNode }) {
  const [activeTerm, setActiveTerm] = useState<string | null>(null);

  const showTerm = useCallback((term: string) => setActiveTerm(term), []);
  const hide = useCallback(() => setActiveTerm(null), []);
  const value = useMemo(() => ({ activeTerm, showTerm, hide }), [activeTerm, showTerm, hide]);

  return <GlossaryContext.Provider value={value}>{children}</GlossaryContext.Provider>;
}

/** Calque plein écran "à la main" (View absolue, pas le composant `<Modal>`
 * natif de RN) : sur ce projet, sous Expo Go avec la New Architecture, `<Modal>`
 * se comporte comme `react-native-reanimated` (cf. FadeInView, usePressScale) —
 * il peut rester accroché au premier plan sans jamais s'afficher, ce qui bloque
 * tout l'input tactile de l'appli.
 *
 * À monter dans CHAQUE écran qui utilise GlossaryText (cf. session-detail-modal,
 * Planning), pas une seule fois à la racine : une View absolue ne s'affiche
 * qu'au-dessus de son propre écran, jamais au-dessus d'un autre écran déjà
 * présenté par-dessus (ex: depuis Planning, ça resterait caché derrière
 * session-detail-modal, déjà ouvert en modal natif). */
export function GlossaryPopup() {
  const { activeTerm, hide } = useGlossary();
  const entry = activeTerm ? lookupGlossaryTerm(activeTerm) : undefined;

  if (activeTerm === null) return null;

  return (
    <Pressable onPress={hide} className="absolute inset-0 z-50 items-center justify-center bg-black/50 px-8">
      <View className="w-full gap-3 rounded-card bg-surface p-5 shadow-card">
        <Text className="text-xs font-bold uppercase tracking-wide text-accent">{activeTerm}</Text>
        <Text className="text-sm leading-5 text-text">{entry?.definition ?? "Définition à venir."}</Text>
        <Pressable onPress={hide} hitSlop={8} className="self-end rounded-full bg-primary px-4 py-2">
          <Text className="text-sm font-bold text-on-primary">Fermer</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
