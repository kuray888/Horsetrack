import { Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { ACTIVITY_META } from "@/agenda/store";
import { formatDuration } from "@/lib/dateFormat";
import type { computeSessionStats } from "@/sessions/stats";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";

export type StatsPeriod = "month" | "all";

/** Statistiques d'entraînement du Planning (ce mois / toujours) — sorties de
 * app/(tabs)/planning.tsx telles quelles. */
export function PlanningStatsCard({
  stats,
  period: period_,
  onChangePeriod,
}: {
  stats: ReturnType<typeof computeSessionStats>;
  period: StatsPeriod;
  onChangePeriod: (period: StatsPeriod) => void;
}) {
  return (
    <View className={CARD}>
        <View className="gap-4">
          <View className="flex-row gap-2 self-start rounded-full bg-background p-1">
            {(["month", "all"] as const).map((period) => (
              <TouchableOpacity accessibilityRole="button"
                key={period}
                onPress={() => onChangePeriod(period)}
                activeOpacity={0.85}
                className={`rounded-full px-3 py-1 ${period_ === period ? "bg-primary" : ""}`}
              >
                <Text className={`text-xs font-semibold ${period_ === period ? "text-on-primary" : "text-muted"}`}>
                  {period === "month" ? t("Ce mois") : t("Toujours")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {stats.sessionCount === 0 && stats.restDays === 0 ? (
            <Text className="text-sm text-muted">{t("Aucune séance faite sur cette période.")}</Text>
          ) : (
            <>
              <View className="flex-row items-center justify-between">
                <View className="items-center gap-0.5">
                  <Text className="text-lg font-display text-text">{stats.sessionCount}</Text>
                  <Text className="text-xs text-muted">{t("séance")}{stats.sessionCount > 1 ? "s" : ""}</Text>
                </View>
                <View className="items-center gap-0.5">
                  <Text className="text-lg font-display text-text">{formatDuration(stats.totalMinutes)}</Text>
                  <Text className="text-xs text-muted">{t("de travail")}</Text>
                </View>
                <View className="items-center gap-0.5">
                  <Text className="text-lg font-display text-text">{stats.perWeek}</Text>
                  <Text className="text-xs text-muted">{t("séance")}{stats.perWeek > 1 ? "s" : ""}{t("/sem.")}</Text>
                </View>
                <View className="items-center gap-0.5">
                  <Text className="text-lg font-display text-text">{stats.restDays}</Text>
                  <Text className="text-xs text-muted">{t("repos")}</Text>
                </View>
              </View>

              {stats.perDiscipline.length > 0 ? (
                <View className="gap-1.5">
                  {stats.perDiscipline.map(({ activityType, count }) => {
                    const meta = ACTIVITY_META[activityType];
                    return (
                      <View key={activityType} className="flex-row items-center gap-2.5">
                        <MaterialCommunityIcons name={meta.icon} size={15} color={meta.tint} />
                        <Text className="flex-1 text-sm text-text">{meta.label}</Text>
                        <Text className="text-sm font-semibold text-text">
                          {count} {t(" séance")}{count > 1 ? "s" : ""}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </>
          )}
        </View>
    </View>
  );
}
