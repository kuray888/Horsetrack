import { Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useSessions } from "@/sessions/store";
import { useHorses } from "@/horses/store";
import { ACTIVITY_META } from "@/agenda/store";
import { RideShareBlock, type ShareSource } from "@/rides/components/RideShareBlock";
import { t } from "@/i18n";

/** Partage d'une séance déjà enregistrée (carte story ou carré, cf. RideShareBlock). */
export default function RideShareScreen() {
  const colors = useThemeColors();
  const { sessionId, from } = useLocalSearchParams<{ sessionId?: string; from?: string }>();
  const { sessions } = useSessions();
  const { horses } = useHorses();
  const session = sessions.find((s) => s.id === sessionId) ?? null;
  const horse = horses.find((h) => h.id === session?.horseId) ?? null;
  const source: ShareSource = from === "replay" ? "replay" : "saved_ride";

  return (
    <Screen>
      <FadeInView>
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 text-3xl font-display tracking-tight text-text" accessibilityRole="header">
            {t("Partager ma séance")}
          </Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("Fermer")} onPress={() => router.back()} hitSlop={10}>
            <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </FadeInView>
      <FadeInView delay={40}>
        {session?.ride ? (
          <RideShareBlock
            ride={session.ride}
            horseName={horse?.name ?? null}
            horsePhoto={horse?.photoUrl ?? null}
            activity={session.customActivityLabel || ACTIVITY_META[session.activityType].label}
            source={source}
            sessionId={session.id}
          />
        ) : (
          <View className="items-center gap-3 rounded-card bg-surface p-5 shadow-card">
            <MaterialCommunityIcons name="map-marker-off-outline" size={28} color={colors.textMuted} />
            <Text className="text-center text-[15px] text-muted">{t("Cette séance n'a pas de parcours à partager.")}</Text>
          </View>
        )}
      </FadeInView>
    </Screen>
  );
}
