import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, AppState, Easing, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { useThemeColors } from "@/theme/ThemeProvider";
import { hapticTap } from "@/lib/haptics";
import { prefersReducedMotion } from "@/lib/motion";
import { createUndoQueue } from "@/lib/undo/undoQueue";
import { tc } from "@/i18n";

/** Durée d'affichage, et délai avant que la suppression parte vraiment. */
const UNDO_DELAY_MS = 5000;
const MESSAGE_MS = 3000;

type ToastEntry = { key: number; message: string; undoId: number | null; onUndo: (() => void) | null };

type ToastApi = {
  /** Message bref, sans action (« Enregistré »). */
  show: (message: string) => void;
  /**
   * Suppression annulable. L'appelant a déjà retiré l'objet de l'écran ;
   * `commit` (suppression sur le serveur) ne part qu'après 5 s, ou dès que
   * l'app passe en arrière-plan ; « Annuler » appelle `undo` à la place.
   */
  showUndo: (message: string, actions: { commit: () => void; undo: () => void }) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Couche de retour commune (audit UX premium § 3.1) : un toast à la fois, en
 * bas de l'écran, au-dessus de la barre d'onglets. Annoncé à VoiceOver.
 * Monté une fois à la racine (cf. app/_layout.tsx), comme LastCrashNotice :
 * il s'affiche au-dessus des écrans poussés, pas des modales natives.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const queue = useMemo(() => createUndoQueue(UNDO_DELAY_MS), []);
  const [entry, setEntry] = useState<ToastEntry | null>(null);
  const keyRef = useRef(0);

  // App en arrière-plan : les suppressions en attente partent maintenant.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") queue.flush();
    });
    return () => {
      sub.remove();
      queue.flush();
    };
  }, [queue]);

  const show = useCallback((message: string) => {
    keyRef.current += 1;
    setEntry({ key: keyRef.current, message, undoId: null, onUndo: null });
    AccessibilityInfo.announceForAccessibility(message);
  }, []);

  const showUndo = useCallback(
    (message: string, actions: { commit: () => void; undo: () => void }) => {
      const undoId = queue.add(actions.commit);
      keyRef.current += 1;
      setEntry({ key: keyRef.current, message, undoId, onUndo: actions.undo });
      AccessibilityInfo.announceForAccessibility(`${message}. ${tc("undo", "Annuler")}`);
    },
    [queue]
  );

  const api = useMemo<ToastApi>(() => ({ show, showUndo }), [show, showUndo]);

  // Stable : ToastView s'en sert dans un effet, qui relancerait son minuteur
  // à chaque rendu avec une fonction neuve.
  const dismiss = useCallback((key: number) => {
    setEntry((cur) => (cur && cur.key === key ? null : cur));
  }, []);

  function undo(current: ToastEntry) {
    if (current.undoId !== null && queue.undo(current.undoId)) {
      hapticTap();
      current.onUndo?.();
    }
    dismiss(current.key);
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      {entry ? <ToastView key={entry.key} entry={entry} onHide={dismiss} onUndo={() => undo(entry)} /> : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé dans <ToastProvider>");
  return ctx;
}

function ToastView({ entry, onHide, onUndo }: { entry: ToastEntry; onHide: (key: number) => void; onUndo: () => void }) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const reduced = prefersReducedMotion();
  const [progress] = useState(() => new Animated.Value(reduced ? 1 : 0));
  const [translateY] = useState(() => progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }));
  const withUndo = entry.undoId !== null;
  const entryKey = entry.key;

  useEffect(() => {
    if (!reduced) {
      Animated.timing(progress, { toValue: 1, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
    const timer = setTimeout(() => onHide(entryKey), withUndo ? UNDO_DELAY_MS : MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [progress, reduced, withUndo, onHide, entryKey]);

  return (
    <View pointerEvents="box-none" className="absolute inset-x-0 px-4" style={{ bottom: insets.bottom + 64 }}>
      <Animated.View
        style={{ opacity: progress, transform: [{ translateY }] }}
        className="flex-row items-center gap-3 rounded-2xl bg-text px-4 py-3 shadow-card"
        accessibilityLiveRegion="polite"
      >
        <MaterialCommunityIcons
          name={withUndo ? "trash-can-outline" : "check-circle-outline"}
          size={20}
          color={colors.surface}
          accessibilityElementsHidden
        />
        <Text className="flex-1 text-[15px] text-surface" numberOfLines={2}>
          {entry.message}
        </Text>
        {withUndo ? (
          <TouchableOpacity
            onPress={onUndo}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={tc("undo", "Annuler")}
            className="min-h-[44px] justify-center px-2"
          >
            <Text className="text-[15px] font-bold text-surface underline">{tc("undo", "Annuler")}</Text>
          </TouchableOpacity>
        ) : null}
      </Animated.View>
    </View>
  );
}
