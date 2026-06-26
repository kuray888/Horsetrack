import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Pressable } from "react-native";

type Entry = { content: ReactNode; onRequestClose: () => void } | null;

type PickerOverlayActions = { show: (content: ReactNode, onRequestClose: () => void) => void; hide: () => void };

const PickerOverlayActionsContext = createContext<PickerOverlayActions | null>(null);
const PickerOverlayEntryContext = createContext<Entry>(null);

/**
 * Calque plein écran partagé pour les sélecteurs de champ (DatePickerField/
 * DropdownField/TimePickerField) — View absolue, pas le `<Modal>` natif de RN :
 * même précédent que glossary/GlossaryProvider.tsx et components/
 * BadgeCelebration.tsx (sous Expo Go avec la New Architecture, `<Modal>` peut
 * rester accroché au premier plan sans jamais s'afficher, ce qui bloque tout
 * l'input tactile de l'appli).
 *
 * Provider monté une seule fois à la racine (cf. _layout.tsx). `PickerOverlaySlot`,
 * lui, doit être monté dans CHAQUE écran qui utilise un de ces champs
 * (directement ou via BreedField/HorseForm/InjuryHistoryField) — une View
 * absolue ne s'affiche qu'au-dessus de son propre écran, jamais au-dessus
 * d'un autre écran déjà présenté par-dessus (même contrainte que GlossaryPopup).
 *
 * `onRequestClose` (pas un `hide()` générique appelé par le calque) : le tap
 * sur le fond doit redescendre dans le champ d'origine pour repasser SON
 * `open` local à false — sinon le champ resterait convaincu d'être encore
 * ouvert et un second tap sur le déclencheur ne rouvrirait rien (React ne
 * redéclenche pas un effet dont la dépendance ne change pas de valeur).
 */
export function PickerOverlayProvider({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<Entry>(null);

  const show = useCallback((content: ReactNode, onRequestClose: () => void) => {
    setEntry({ content, onRequestClose });
  }, []);
  const hide = useCallback(() => setEntry(null), []);
  const actions = useMemo<PickerOverlayActions>(() => ({ show, hide }), [show, hide]);

  return (
    <PickerOverlayActionsContext.Provider value={actions}>
      <PickerOverlayEntryContext.Provider value={entry}>{children}</PickerOverlayEntryContext.Provider>
    </PickerOverlayActionsContext.Provider>
  );
}

export function usePickerOverlay(): PickerOverlayActions {
  const ctx = useContext(PickerOverlayActionsContext);
  if (!ctx) throw new Error("usePickerOverlay doit être utilisé dans <PickerOverlayProvider>");
  return ctx;
}

export function PickerOverlaySlot() {
  const entry = useContext(PickerOverlayEntryContext);
  if (!entry) return null;
  return (
    <Pressable onPress={entry.onRequestClose} className="absolute inset-0 z-50 items-center justify-center bg-black/40 p-6">
      {entry.content}
    </Pressable>
  );
}
