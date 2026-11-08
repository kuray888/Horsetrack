import { useMemo } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { FadeInView } from "@/components/FadeInView";
import { Image } from "@/components/AppImage";
import { PrimaryButton } from "@/components/onboarding";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useSelectableHorses } from "@/horses/useSelectableHorses";
import { useAgenda } from "@/agenda/store";
import { useSessions } from "@/sessions/store";
import { useSubscription } from "@/subscription/store";
import { APPT_META, daysUntilLabel, formatAmount } from "@/agenda/meta";
import { buildStableOverview, type StableHorseRow } from "@/stable/stableOverview";
import { track } from "@/lib/analytics";
import { t } from "@/i18n";

/** Vue écurie (Écurie Pro) : chaque cheval sur une ligne, ceux qui demandent
 * de l'attention en tête (cf. stable/stableOverview.ts). */
export default function StableScreen() {
  const colors = useThemeColors();
  const { isPro } = useSubscription();
  const horses = useSelectableHorses();
  const { appointments, expenses } = useAgenda();
  const { sessions } = useSessions();
  const rows = useMemo(
    () =>
      buildStableOverview({
        horses: horses.map((h) => ({ id: h.id, name: h.name, photoUrl: h.photoUrl })),
        appointments,
        sessions,
        expenses,
        today: new Date(),
      }),
    [horses, appointments, sessions, expenses]
  );
  const overdueTotal = rows.reduce((n, r) => n + r.overdue.length, 0);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between px-5 pt-2">
        <Text className="text-2xl font-display tracking-tight text-text">{t("Vue écurie")}</Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel={t("Fermer")} accessibilityRole="button">
          <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} accessibilityElementsHidden />
        </TouchableOpacity>
      </View>

      {!isPro ? (
        <View className="flex-1 justify-center gap-4 px-6">
          <MaterialCommunityIcons name="view-dashboard-outline" size={40} color={colors.primary} />
          <Text className="text-xl font-display-bold text-text">{t("Toute ton écurie sur un écran")}</Text>
          <Text className="text-base text-muted">
            {t("Soins en retard, prochaines échéances, séances de la semaine et dépenses du mois, pour chaque cheval. Inclus dans Écurie Pro.")}
          </Text>
          <PrimaryButton
            label={t("Découvrir Écurie Pro")}
            onPress={() => {
              track("locked_feature_tapped", { feature: "stable_view", placement: "pro" });
              router.replace("/pro");
            }}
          />
        </View>
      ) : (
        <ScrollView contentContainerClassName="px-5 pt-4 pb-8 gap-3" showsVerticalScrollIndicator={false}>
          <FadeInView>
            <View className={`flex-row items-center gap-2 rounded-card p-4 ${overdueTotal > 0 ? "bg-warning/15" : "bg-success/15"}`}>
              <MaterialCommunityIcons
                name={overdueTotal > 0 ? "alert-circle-outline" : "check-circle-outline"}
                size={20}
                color={overdueTotal > 0 ? colors.warning : colors.success}
              />
              <Text className="flex-1 text-sm font-semibold text-text">
                {overdueTotal === 0
                  ? t("Aucun soin en retard dans l'écurie.")
                  : overdueTotal === 1
                    ? t("1 soin en retard dans l'écurie.")
                    : t("{n} soins en retard dans l'écurie.", { n: overdueTotal })}
              </Text>
            </View>
          </FadeInView>
          <FadeInView delay={30}>
            <TouchableOpacity
              onPress={() => router.push("/planning-semaine")}
              activeOpacity={0.85}
              accessibilityRole="button"
              className="flex-row items-center gap-3 rounded-card bg-surface p-4"
            >
              <MaterialCommunityIcons name="calendar-week" size={20} color={colors.primary} />
              <Text className="flex-1 text-sm font-semibold text-text">{t("Planning de la semaine : qui monte quoi, quand")}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </FadeInView>
          {rows.map((row, i) => (
            <FadeInView key={row.horseId} delay={60 + i * 40}>
              <StableRow row={row} />
            </FadeInView>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StableRow({ row }: { row: StableHorseRow }) {
  const colors = useThemeColors();
  const next = row.nextDue;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.85}
      onPress={() => router.push(`/horse/${row.horseId}`)}
      className="gap-3 rounded-card bg-surface p-4 shadow-card"
    >
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-highlight">
          {row.photoUrl ? (
            <Image source={{ uri: row.photoUrl }} style={{ width: 44, height: 44 }} contentFit="cover" />
          ) : (
            <MaterialCommunityIcons name="horse-variant" size={20} color={colors.primary} />
          )}
        </View>
        <Text className="flex-1 text-base font-bold text-text" numberOfLines={1}>
          {row.name}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
      </View>

      {row.overdue.map((a) => (
        <View key={a.id} className="flex-row items-center gap-2">
          <MaterialCommunityIcons name="alert-circle" size={16} color={colors.warning} />
          <Text className="flex-1 text-sm font-semibold text-text">
            {t("{care} en retard", { care: APPT_META[a.type].label })}
          </Text>
        </View>
      ))}

      <View className="flex-row flex-wrap gap-x-4 gap-y-1">
        <Text className="text-[13px] text-muted">
          {next
            ? t("Prochain soin : {care} {when}", { care: APPT_META[next.type].label, when: daysUntilLabel(next.nextDueDate!) })
            : t("Aucune échéance à venir")}
        </Text>
        <Text className="text-[13px] text-muted">
          {t("Séances : {done}/{total} cette semaine", { done: row.weekDone, total: row.weekTotal })}
        </Text>
        <Text className="text-[13px] text-muted">
          {t("Dépenses du mois : {amount}", { amount: formatAmount(row.monthExpenses, "EUR") })}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
