import { Modal, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeColors } from "@/theme/ThemeProvider";

export type QuickAddOption = "seance" | "soin" | "rendezvous" | "concours" | "depense" | "journal";

const OPTIONS: { value: QuickAddOption; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { value: "seance", label: "Séance", icon: "horse-variant" },
  { value: "soin", label: "Soin", icon: "needle" },
  { value: "rendezvous", label: "Rendez-vous", icon: "calendar-blank-outline" },
  { value: "concours", label: "Concours", icon: "trophy-outline" },
  { value: "depense", label: "Dépense", icon: "wallet-outline" },
  { value: "journal", label: "Journal", icon: "notebook-outline" },
];

/** Feuille d'ajout rapide du Horse Hub (cf. plan Phase 3 §5) — pure
 * présentation, ne sait rien de ce que chaque option déclenche (cf.
 * `onSelect` dans app/horse/[id]/index.tsx, qui route vers les
 * formulaires/écrans déjà existants). */
export function QuickAddSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (option: QuickAddOption) => void;
}) {
  const colors = useThemeColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} className="flex-1 justify-end bg-black/40">
        <TouchableOpacity activeOpacity={1} className="gap-1 rounded-t-2xl bg-surface p-5 pb-8">
          <Text className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-muted">Ajouter</Text>
          {OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => onSelect(opt.value)}
              activeOpacity={0.8}
              className="flex-row items-center gap-3 rounded-card p-3"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-highlight">
                <MaterialCommunityIcons name={opt.icon} size={18} color={colors.primary} />
              </View>
              <Text className="text-base font-semibold text-text">{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
