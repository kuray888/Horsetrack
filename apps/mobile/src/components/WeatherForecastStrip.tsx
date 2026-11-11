import { Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useWeather } from "@/weather/store";
import { t } from "@/i18n";

const DAY_SHORT_BY_GETDAY = [t("Dim."), t("Lun."), t("Mar."), t("Mer."), t("Jeu."), t("Ven."), t("Sam.")];

/** « Auj. » comme l'app Météo d'iOS : « Aujourd'hui » ne tient pas dans une
 * carte de 72 pt et s'affichait tronqué (« Aujourd… »). */
function dayLabel(date: Date, index: number): string {
  if (index === 0) return t("Auj.");
  if (index === 1) return t("Demain");
  return DAY_SHORT_BY_GETDAY[date.getDay()];
}

/**
 * Aperçu météo des prochains jours — purement indicatif (prévision MET Norway via notre API,
 * même best-effort que lib/weather.ts), pour anticiper les séances et
 * rendez-vous à venir dans le planning. Se masque entièrement si la position
 * n'est pas disponible (permission refusée, etc.) plutôt que d'afficher un
 * état d'erreur — un bonus, jamais un blocage.
 */
export function WeatherForecastStrip() {
  const { forecast } = useWeather();

  if (!forecast || forecast.length === 0) return null;

  return (
    <View className="gap-3">
    {/* Bord à bord (-mx-5 annule le padding de <Screen>) avec une marge
        intérieure pour l'ombre des cartes : sans elle, le défilement coupait
        l'ombre net et dessinait un rectangle à angles droits derrière les
        cartes arrondies. */}
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="-mx-5 -my-2"
      contentContainerClassName="gap-2.5 px-5 py-2"
    >
      {forecast.map((day, i) => (
        <View
          key={day.date.toISOString()}
          accessible
          accessibilityLabel={t("{v} : {label}, {tempMaxC} degrés, minimum {tempMinC}", {
            v: i === 0 ? t("Aujourd'hui") : i === 1 ? t("Demain") : dayLabel(day.date, i),
            label: day.label,
            tempMaxC: day.tempMaxC,
            tempMinC: day.tempMinC,
          })}
          className="w-[72px] items-center gap-1 rounded-card bg-surface p-3 shadow-card"
        >
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
      {/* Attribution exigée par la licence des données (CC BY 4.0). */}
      <TouchableOpacity
        onPress={() => void Linking.openURL("https://api.met.no/doc/License")}
        accessibilityRole="link"
        hitSlop={8}
        className="self-start"
      >
        <Text className="text-[11px] text-muted">{t("Prévisions : MET Norway")}</Text>
      </TouchableOpacity>
    </View>
  );
}
