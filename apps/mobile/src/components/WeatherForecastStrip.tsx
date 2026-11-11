import { Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useWeather } from "@/weather/store";
import { bestRideWindow, weatherAlerts, type WeatherAlert } from "@/weather/rideWindow";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { useThemeColors } from "@/theme/ThemeProvider";
import { LOCALE, t } from "@/i18n";

const DAY_SHORT_BY_GETDAY = [t("Dim."), t("Lun."), t("Mar."), t("Mer."), t("Jeu."), t("Ven."), t("Sam.")];

/** « Auj. » comme l'app Météo d'iOS : « Aujourd'hui » ne tient pas dans une
 * carte de 72 pt et s'affichait tronqué (« Aujourd… »). */
function dayLabel(date: Date, index: number): string {
  if (index === 0) return t("Auj.");
  if (index === 1) return t("Demain");
  return DAY_SHORT_BY_GETDAY[date.getDay()];
}

const ALERTS: Record<WeatherAlert, { icon: "snowflake" | "white-balance-sunny" | "weather-windy" | "weather-lightning"; text: string }> = {
  frost: { icon: "snowflake", text: t("Gel prévu : sol dur, pense à l'abreuvoir.") },
  heat: { icon: "white-balance-sunny", text: t("Forte chaleur : monte tôt et fais boire ton cheval.") },
  wind: { icon: "weather-windy", text: t("Vent fort prévu : cheval souvent plus vif, prudence en extérieur.") },
  storm: { icon: "weather-lightning", text: t("Orage prévu : ne monte pas pendant l'orage.") },
};

const hourLabel = (d: Date) => d.toLocaleTimeString(LOCALE, { hour: "numeric" });

/**
 * Aperçu météo des prochains jours — purement indicatif (prévision MET Norway via notre API,
 * même best-effort que lib/weather.ts), pour anticiper les séances et
 * rendez-vous à venir dans le planning. Se masque entièrement si la position
 * n'est pas disponible (permission refusée, etc.) plutôt que d'afficher un
 * état d'erreur — un bonus, jamais un blocage.
 */
export function WeatherForecastStrip() {
  const { forecast, hours } = useWeather();
  const colors = useThemeColors();
  const now = new Date();
  // Lecture « cavalier » de la journée (cf. weather/rideWindow.ts).
  const rideWindow = hours ? bestRideWindow(hours, now) : null;
  const alerts = hours ? weatherAlerts(hours, now) : [];

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
      {rideWindow ? (
        <View className="flex-row items-center gap-3 rounded-card bg-surface px-4 py-3 shadow-card">
          <MaterialCommunityIcons name="horse-variant" size={20} color={colors.primary} accessibilityElementsHidden />
          <Text className="flex-1 text-[15px] text-text">
            {t("Pour monter aujourd'hui : {from} – {to}, jusqu'à {temp}°", {
              from: hourLabel(rideWindow.start),
              to: hourLabel(rideWindow.end),
              temp: rideWindow.tempC,
            })}
          </Text>
        </View>
      ) : null}
      {alerts.map((a) => (
        <View key={a} className="flex-row items-center gap-3 rounded-card bg-warning/15 px-4 py-3">
          <MaterialCommunityIcons name={ALERTS[a].icon} size={20} color={colors.warning} accessibilityElementsHidden />
          <Text className="flex-1 text-[15px] text-text">{ALERTS[a].text}</Text>
        </View>
      ))}
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
