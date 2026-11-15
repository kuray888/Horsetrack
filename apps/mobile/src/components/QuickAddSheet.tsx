import { useEffect, useState } from "react";
import { Animated, Easing, Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { useThemeColors } from "@/theme/ThemeProvider";
import { openFormForQuickAdd } from "@/planning/planningDestination";
import { useHorses } from "@/horses/store";
import { quickAddAllowed, roleOf } from "@/lib/permissions";
import { t } from "@/i18n";
import { hapticSelection } from "@/lib/haptics";
import { prefersReducedMotion } from "@/lib/motion";

export type QuickAddOption = "cheval" | "direct" | "seance" | "soin" | "rendezvous" | "concours" | "depense" | "journal";

/** Proposé en tête seulement depuis l'onglet Chevaux (`withHorse`). */
const HORSE_OPTION = { value: "cheval" as const, label: t("Un cheval"), icon: "horse-variant-fast" as const };

const OPTIONS: { value: QuickAddOption; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { value: "direct", label: t("Séance en direct (chrono, GPS)"), icon: "play-circle-outline" },
  { value: "seance", label: t("Séance"), icon: "horse-variant" },
  { value: "soin", label: t("Soin"), icon: "needle" },
  { value: "rendezvous", label: t("Rendez-vous"), icon: "calendar-blank-outline" },
  { value: "concours", label: t("Concours"), icon: "trophy-outline" },
  { value: "depense", label: t("Dépense"), icon: "wallet-outline" },
  { value: "journal", label: t("Journal"), icon: "notebook-outline" },
];

/** Feuille d'ajout rapide du Horse Hub (cf. plan Phase 3 §5) — pure
 * présentation, ne sait rien de ce que chaque option déclenche (cf.
 * `onSelect` dans app/horse/[id]/index.tsx, qui route vers les
 * formulaires/écrans déjà existants). */
export function QuickAddSheet({
  visible,
  onClose,
  onSelect,
  withHorse = false,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (option: QuickAddOption) => void;
  withHorse?: boolean;
}) {
  const colors = useThemeColors();
  // Cheval actif partagé : seulement ce que son rôle permet (cf.
  // lib/permissions.ts) — une demi-pension n'ajoute pas de dépense.
  const { selectedHorse } = useHorses();
  const role = roleOf(selectedHorse?.sharedRole, selectedHorse?.sharedFullAccess);
  const options = (withHorse ? [HORSE_OPTION, ...OPTIONS] : OPTIONS).filter((opt) => quickAddAllowed(role, opt.value));
  // Fond en fondu, feuille qui glisse : avec animationType="slide", le voile
  // sombre montait avec la feuille, comme un bloc.
  const insets = useSafeAreaInsets();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!visible) return;
    if (prefersReducedMotion()) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [visible, progress]);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [360, 0] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        {/* Fond séparé de la feuille (et non plus parent de celle-ci) : un
            bouton qui en contient d'autres devient UN seul élément pour
            VoiceOver, et les options de la feuille étaient inatteignables. */}
        <Animated.View style={{ opacity: progress }} className="absolute inset-0">
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("Fermer")}
            className="flex-1 bg-black/40"
          />
        </Animated.View>
        <Animated.View
          style={{ transform: [{ translateY }], paddingBottom: Math.max(insets.bottom, 16) + 8 }}
          className="gap-1 rounded-t-2xl bg-surface px-5 pt-3"
          accessibilityViewIsModal
        >
          {/* Poignée : la feuille se lit comme une feuille iOS. */}
          <View className="mb-2 h-1 w-10 self-center rounded-full bg-border" accessibilityElementsHidden />
          <Text className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-muted" accessibilityRole="header">
            {t("Ajouter")}
          </Text>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => {
                hapticSelection();
                onSelect(opt.value);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              className="flex-row items-center gap-3 rounded-card p-3"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-highlight">
                <MaterialCommunityIcons name={opt.icon} size={20} color={colors.primary} />
              </View>
              <Text className="text-base font-semibold text-text">{opt.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.8}
            accessibilityRole="button"
            className="mt-2 min-h-[44px] items-center justify-center rounded-card bg-background"
          >
            <Text className="text-base font-semibold text-text">{t("Annuler")}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * Choix de la feuille fait depuis un onglet qui n'a pas ce formulaire
 * (Journal, Chevaux) : la séance en direct s'ouvre par-dessus, les autres
 * formulaires dans le Planning, qui les a tous (cf.
 * planning/planningDestination.ts). `ts` rend chaque demande unique : le
 * Planning reste monté entre deux visites.
 *
 * Depuis un onglet seulement : un écran empilé passe par `dismissTo` (cf.
 * horses/horseHubNavigation.test.ts).
 */
export function openQuickAddFromTab(option: QuickAddOption): void {
  if (option === "direct") {
    router.push("/ride");
    return;
  }
  if (option === "cheval") {
    router.push("/add-horse-modal");
    return;
  }
  const form = openFormForQuickAdd(option);
  if (form) router.push({ pathname: "/(tabs)/planning", params: { openForm: form, ts: String(Date.now()) } });
}
