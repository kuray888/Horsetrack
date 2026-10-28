import { Text, View } from "react-native";
import { formatDuration } from "@/lib/dateFormat";
import type { Gait } from "@/rides/rideMath";
import { t } from "@/i18n";

export const GAIT_LABEL: Record<Gait, string> = {
  walk: t("Pas"),
  trot: t("Trot"),
  canter: t("Galop"),
  halt: t("Arrêt"),
};

/** Classes de couleur sémantiques, cf. tailwind.config.js. */
const GAIT_BAR: Record<Gait, string> = {
  walk: "bg-success",
  trot: "bg-accent",
  canter: "bg-primary",
  halt: "bg-border",
};

function minutes(seconds: number): string {
  return seconds < 60 ? t("{v} s", { v: Math.round(seconds) }) : formatDuration(Math.round(seconds / 60));
}

/** Temps passé à chaque allure : une barre empilée, puis le détail. */
export function GaitBreakdown({ seconds }: { seconds: Record<Gait, number> }) {
  const order: Gait[] = ["walk", "trot", "canter", "halt"];
  const total = order.reduce((s, g) => s + seconds[g], 0);
  if (total <= 0) return null;
  return (
    <View
      className="gap-3"
      accessible
      accessibilityLabel={t("Allures estimées : {v}", { v: order
        .filter((g) => seconds[g] > 0)
        .map((g) => `${GAIT_LABEL[g]} ${minutes(seconds[g])}`)
        .join(", ") })}
    >
      <View className="h-3 flex-row overflow-hidden rounded-full bg-border/40">
        {order.map((g) =>
          seconds[g] > 0 ? <View key={g} className={GAIT_BAR[g]} style={{ flex: seconds[g] / total }} /> : null
        )}
      </View>
      <View className="flex-row flex-wrap gap-x-4 gap-y-1">
        {order.map((g) =>
          seconds[g] > 0 ? (
            <View key={g} className="flex-row items-center gap-1.5">
              <View className={`h-2.5 w-2.5 rounded-full ${GAIT_BAR[g]}`} />
              <Text className="text-sm text-text">
                {GAIT_LABEL[g]} <Text className="font-semibold">{minutes(seconds[g])}</Text>
              </Text>
            </View>
          ) : null
        )}
      </View>
    </View>
  );
}
