import { Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { useThemeColors } from "@/theme/ThemeProvider";
import { DAY_LABELS, isSameDate, MONTHS } from "@/lib/dateFormat";
import { buildMonthGrid } from "@/planning/calendar";
import type { UnifiedEvent } from "@/planning/unifiedEvents";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";

/** Vue « Mois » du Planning — sortie de app/(tabs)/planning.tsx telle quelle. */
const WEEKDAY_HEADER = DAY_LABELS;

export function MonthGrid({
  monthCursor,
  selectedDay,
  onSelectDay,
  onChangeMonth,
  eventsByDay,
}: {
  monthCursor: Date;
  selectedDay: Date;
  onSelectDay: (d: Date) => void;
  onChangeMonth: (delta: number) => void;
  eventsByDay: Map<string, UnifiedEvent[]>;
}) {
  const colors = useThemeColors();
  const todayKey = new Date().toDateString();
  const days = buildMonthGrid(monthCursor);
  return (
    <View className={`${CARD} gap-3`}>
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-bold capitalize text-text">
          {MONTHS[monthCursor.getMonth()]} {monthCursor.getFullYear()}
        </Text>
        <View className="flex-row gap-1">
          <TouchableOpacity onPress={() => onChangeMonth(-1)} hitSlop={8} className="p-1.5" accessibilityRole="button" accessibilityLabel={t("Mois précédent")}>
            <MaterialCommunityIcons name="chevron-left" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onChangeMonth(1)} hitSlop={8} className="p-1.5" accessibilityRole="button" accessibilityLabel={t("Mois suivant")}>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
      <View className="flex-row">
        {WEEKDAY_HEADER.map((w, i) => (
          <Text key={i} className="flex-1 text-center text-xs font-semibold uppercase text-muted">
            {w}
          </Text>
        ))}
      </View>
      <View className="flex-row flex-wrap">
        {days.map((d) => {
          const inMonth = d.getMonth() === monthCursor.getMonth();
          const isToday = d.toDateString() === todayKey;
          const isSelected = isSameDate(d, selectedDay);
          const dayEvents = eventsByDay.get(d.toDateString()) ?? [];
          return (
            <TouchableOpacity accessibilityRole="button"
              key={d.toDateString()}
              onPress={() => onSelectDay(d)}
              activeOpacity={0.7}
              className="w-[14.28%] items-center gap-1 py-1.5"
            >
              <View
                className={`h-8 w-8 items-center justify-center rounded-full ${
                  isSelected ? "bg-primary" : isToday ? "bg-highlight" : ""
                }`}
              >
                <Text
                  className={`text-sm ${!inMonth ? "text-border" : isSelected ? "font-bold text-on-primary" : "text-text"}`}
                >
                  {d.getDate()}
                </Text>
              </View>
              <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dayEvents.length > 0 ? colors.accent : "transparent" }} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
