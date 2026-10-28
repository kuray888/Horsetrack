import { Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { useThemeColors } from "@/theme/ThemeProvider";
import { activeSeconds, formatClock } from "@/rides/rideMath";
import { isRidePaused } from "@/rides/recorder";
import { useNow, useRideDraft } from "@/rides/useRide";
import { t } from "@/i18n";

/**
 * Rappel d'une séance en direct en cours (ou terminée, pas encore
 * enregistrée) : l'écran de séance se ferme d'un geste sans arrêter le
 * chrono, ce bandeau permet d'y revenir.
 */
export function RideInProgressBanner() {
  const colors = useThemeColors();
  const draft = useRideDraft();
  const running = !!draft && draft.endedAt === null && !isRidePaused(draft);
  const now = useNow(running);
  if (!draft) return null;

  const finished = draft.endedAt !== null;
  const label = finished
    ? t("Séance terminée, à enregistrer")
    : `${isRidePaused(draft) ? t("En pause") : t("Séance en cours")} · ${formatClock(activeSeconds(draft.startedAt, draft.pauses, now))}`;

  return (
    <TouchableOpacity
      className="flex-row items-center gap-3 rounded-card bg-primary p-4"
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={t("{label}. Ouvrir la séance", { label: label })}
      onPress={() => router.push("/ride")}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-on-primary/20">
        <MaterialCommunityIcons name={finished ? "flag-checkered" : "record-circle-outline"} size={20} color={colors.textOnPrimary} />
      </View>
      <Text className="flex-1 text-base font-bold text-on-primary" style={{ fontVariant: ["tabular-nums"] }}>
        {label}
      </Text>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textOnPrimary} />
    </TouchableOpacity>
  );
}
