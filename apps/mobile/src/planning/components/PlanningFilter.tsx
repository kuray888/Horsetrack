import { ScrollView, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { useThemeColors } from "@/theme/ThemeProvider";
import type { PlanningFilterValue } from "@/planning/unifiedEvents";
import { t } from "@/i18n";

const OPTIONS: { value: PlanningFilterValue; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { value: "all", label: t("Tous"), icon: "view-grid-outline" },
  { value: "session", label: t("Séances"), icon: "horse-variant" },
  { value: "soin", label: t("Soins"), icon: "needle" },
  { value: "concours", label: t("Concours"), icon: "trophy-outline" },
  { value: "autre", label: t("Autres"), icon: "calendar-blank-outline" },
];

/** Filtre du Planning unifié (Tous/Séances/Soins/Concours/Autres, cf. plan
 * Phase 3 Étape 3 §3) — modifie uniquement l'affichage, jamais les données
 * sous-jacentes (cf. filterUnifiedEvents, pure fonction sur la liste déjà
 * chargée). Remplace l'ancien filtre par discipline de Planning : une fois
 * les rendez-vous mêlés aux séances, filtrer par discipline de séance seule
 * n'avait plus de sens pour les événements non-séance. */
export function PlanningFilter({
  value,
  onChange,
}: {
  value: PlanningFilterValue;
  onChange: (value: PlanningFilterValue) => void;
}) {
  const colors = useThemeColors();
  return (
    // Une seule ligne qui défile, bord à bord (même marge que l'écran) : les
    // cinq filtres passaient sur deux lignes et repoussaient la liste.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="-mx-5"
      contentContainerClassName="gap-2 px-5"
    >
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
            accessibilityLabel={opt.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`flex-row items-center gap-1.5 rounded-full border px-3.5 py-2 ${
              selected ? "border-primary bg-highlight" : "border-border bg-surface"
            }`}
          >
            <MaterialCommunityIcons name={opt.icon} size={15} color={selected ? colors.primary : colors.textMuted} accessibilityElementsHidden />
            <Text className={`text-sm font-semibold ${selected ? "text-primary" : "text-text"}`}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
