import { useEffect, useState } from "react";
import { Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { isHorseShared } from "@/community/api";
import type { TargetType } from "@/community/model";
import { t } from "@/i18n";

/**
 * « Commentaires » d'une séance ou d'un souvenir (carte dépliée). Affiché
 * seulement pour un cheval partagé : seul, il n'y a personne à qui parler.
 */
export function CommentsButton({ horseId, targetType, targetId }: { horseId: string | null; targetType: TargetType; targetId: string }) {
  const colors = useThemeColors();
  const { horses } = useHorses();
  const horse = horses.find((h) => h.id === horseId) ?? null;
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (!horse) return;
    let cancelled = false;
    isHorseShared(horse.id, horse.sharedRole).then((v) => {
      if (!cancelled) setShared(v);
    });
    return () => {
      cancelled = true;
    };
  }, [horse]);

  if (!horse || !shared) return null;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/comments", params: { horseId: horse.id, targetType, targetId } })}
      activeOpacity={0.8}
      className="flex-row items-center justify-center gap-1.5 rounded-card border border-border p-3"
    >
      <MaterialCommunityIcons name="message-text-outline" size={15} color={colors.accent} />
      <Text className="text-sm font-semibold text-text">{t("Commentaires")}</Text>
    </TouchableOpacity>
  );
}
