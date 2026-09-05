import { Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import { formatDate } from "@/lib/dateFormat";
import type { ActivityEntry } from "@/agenda/activity";

/** Liste chronologique en lecture seule (séances, soins, journal, dépenses…)
 * — même rendu que l'ancien horse-history-modal.tsx, extrait pour être
 * partagé entre lui et le Horse Hub (cf. plan Phase 3 Étape 2). `limit`
 * tronque l'affichage (aperçu du Hub) sans changer les données passées. */
export function ActivityFeed({
  entries,
  limit,
  emptyMessage,
}: {
  entries: ActivityEntry[];
  limit?: number;
  emptyMessage: string;
}) {
  const shown = limit !== undefined ? entries.slice(0, limit) : entries;

  if (shown.length === 0) {
    return (
      <View className="items-center gap-2 rounded-card bg-surface p-6 shadow-card">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
          <MaterialCommunityIcons name="history" size={22} color={colors.textMuted} />
        </View>
        <Text className="text-center text-sm text-muted">{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      {shown.map((entry) => (
        <View key={entry.id} className="flex-row items-center gap-3 rounded-card bg-surface p-4 shadow-card">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-highlight">
            <MaterialCommunityIcons name={entry.icon} size={18} color={entry.iconColor} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-bold text-text">{entry.title}</Text>
            {entry.subtitle ? (
              <Text className="text-xs text-muted" numberOfLines={1}>
                {entry.subtitle}
              </Text>
            ) : null}
          </View>
          <Text className="text-xs text-muted">{formatDate(entry.date)}</Text>
        </View>
      ))}
    </View>
  );
}
