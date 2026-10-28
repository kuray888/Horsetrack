import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { useThemeColors } from "@/theme/ThemeProvider";
import { openFormForQuickAdd } from "@/planning/planningDestination";
import { t } from "@/i18n";

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
  const options = withHorse ? [HORSE_OPTION, ...OPTIONS] : OPTIONS;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        {/* Fond séparé de la feuille (et non plus parent de celle-ci) : un
            bouton qui en contient d'autres devient UN seul élément pour
            VoiceOver, et les options de la feuille étaient inatteignables. */}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("Fermer")}
          className="absolute inset-0 bg-black/40"
        />
        <View className="gap-1 rounded-t-2xl bg-surface p-5 pb-8" accessibilityViewIsModal>
          <Text className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-muted" accessibilityRole="header">
            {t("Ajouter")}
          </Text>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => onSelect(opt.value)}
              activeOpacity={0.8}
              accessibilityRole="button"
              className="flex-row items-center gap-3 rounded-card p-3"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-highlight">
                <MaterialCommunityIcons name={opt.icon} size={18} color={colors.primary} />
              </View>
              <Text className="text-base font-semibold text-text">{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
