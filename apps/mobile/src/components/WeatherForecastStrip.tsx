import { ScrollView, Text, View } from "react-native";
import { useWeather } from "@/weather/store";

const DAY_SHORT_BY_GETDAY = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];

function dayLabel(date: Date, index: number): string {
  if (index === 0) return "Aujourd'hui";
  if (index === 1) return "Demain";
  return DAY_SHORT_BY_GETDAY[date.getDay()];
}

/**
 * Aperçu météo des prochains jours — purement indicatif (prévision Open-Meteo,
 * même best-effort que lib/weather.ts), pour anticiper les séances et
 * rendez-vous à venir dans le planning. Se masque entièrement si la position
 * n'est pas disponible (permission refusée, etc.) plutôt que d'afficher un
 * état d'erreur — un bonus, jamais un blocage.
 */
export function WeatherForecastStrip() {
  const { forecast } = useWeather();

  if (!forecast || forecast.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2.5 pr-2">
      {forecast.map((day, i) => (
        <View key={day.date.toISOString()} className="w-[72px] items-center gap-1 rounded-card bg-surface p-3 shadow-card">
          <Text className="text-xs font-semibold text-muted" numberOfLines={1}>
            {dayLabel(day.date, i)}
          </Text>
          <Text className="text-2xl">{day.icon}</Text>
          <Text className="text-sm font-bold text-text">
            {day.tempMaxC}° <Text className="text-xs font-semibold text-muted">{day.tempMinC}°</Text>
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
