import { View, Text } from "react-native";

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

type Props = {
  /** Jours complétés cette semaine, Lundi → Dimanche. */
  completed: boolean[];
};

/** Frise des 7 jours de la semaine, façon "streak" Duolingo. */
export function WeekStreak({ completed }: Props) {
  const todayIndex = (new Date().getDay() + 6) % 7;

  return (
    <View className="flex-row justify-between">
      {DAY_LABELS.map((label, i) => {
        const done = completed[i];
        const isToday = i === todayIndex;
        return (
          <View key={i} className="items-center gap-1.5">
            <Text className="text-xs font-semibold text-muted">{label}</Text>
            <View
              className={`h-9 w-9 items-center justify-center rounded-full ${
                done
                  ? "bg-primary"
                  : isToday
                    ? "border-2 border-primary bg-transparent"
                    : "border border-border bg-transparent"
              }`}
            >
              {done ? <Text className="text-sm font-bold text-on-primary">✓</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
