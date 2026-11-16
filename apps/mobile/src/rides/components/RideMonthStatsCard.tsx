import { useEffect, useMemo } from "react";
import { Text, View } from "react-native";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Locked } from "@/components/Locked";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useSubscription } from "@/subscription/store";
import { useSessions } from "@/sessions/store";
import { rideMonthStats, type RideLike } from "@/rides/monthStats";
import { formatDistance } from "@/rides/rideMath";
import { track } from "@/lib/analytics";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const MASK = "—";

function hours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? t("{h} h {m} min", { h, m }) : t("{m} min", { m });
}

/**
 * Bilan du mois après une séance en direct (Premium, cf. rides/monthStats.ts).
 * En gratuit, la carte montre ce qu'elle contiendrait, valeurs masquées, et
 * ouvre le paywall « live_ride » : la séance elle-même reste gratuite.
 */
export function RideMonthStatsCard({ current, source }: { current: RideLike; source: "ride_end" | "replay" }) {
  const colors = useThemeColors();
  const { isActiveOrTrialing } = useSubscription();
  const { sessions } = useSessions();
  const stats = useMemo(() => rideMonthStats(sessions, current), [sessions, current]);
  const premium = isActiveOrTrialing;

  useEffect(() => {
    track("ride_stats_viewed", { source, premium });
  }, [source, premium]);

  const show = (v: string) => (premium ? v : MASK);
  const canter =
    stats.canterChangePct === null
      ? null
      : stats.canterChangePct >= 0
        ? t("Galop : +{pct} % par rapport au mois dernier", { pct: stats.canterChangePct })
        : t("Galop : {pct} % par rapport au mois dernier", { pct: stats.canterChangePct });

  return (
    <Locked message={t("Vois tes kilomètres du mois, tes allures comparées et tes records")} placement="live_ride" feature={`ride_stats_${source}`}>
      <View className={`${CARD} gap-3`}>
        <View className="flex-row items-center gap-2">
          <MaterialCommunityIcons name="calendar-month-outline" size={20} color={colors.primary} />
          <Text className="text-base font-semibold text-text">{t("Ce mois-ci")}</Text>
        </View>
        <View className="flex-row justify-between">
          <View className="gap-1">
            <Text className="text-xl font-bold text-text">{show(String(stats.month.rides))}</Text>
            <Text className="text-xs text-muted">{stats.month.rides > 1 ? t("sorties") : t("sortie")}</Text>
          </View>
          <View className="gap-1">
            <Text className="text-xl font-bold text-text">{show(formatDistance(stats.month.distanceMeters))}</Text>
            <Text className="text-xs text-muted">{t("parcourus")}</Text>
          </View>
          <View className="gap-1">
            <Text className="text-xl font-bold text-text">{show(hours(stats.month.seconds))}</Text>
            <Text className="text-xs text-muted">{t("en selle")}</Text>
          </View>
        </View>
        {premium && canter ? <Text className="text-sm text-text">{canter}</Text> : null}
        {premium && stats.distanceRecord ? (
          <View className="flex-row items-center gap-2">
            <MaterialCommunityIcons name="trophy-outline" size={16} color={colors.accent} />
            <Text className="text-sm font-semibold text-text">{t("Record : ta plus longue sortie avec ce cheval")}</Text>
          </View>
        ) : null}
        {!premium ? <Text className="text-sm text-muted">{t("Allures comparées au mois dernier et records")}</Text> : null}
      </View>
    </Locked>
  );
}
