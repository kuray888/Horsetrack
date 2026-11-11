import * as Location from "expo-location";
import { runNativeInteraction } from "@/lib/nativeInteraction";
import { t } from "@/i18n";
import { weatherApiPath } from "@/lib/weatherRequest";
import { currentFromHours, dailyFromHours, type WeatherHour } from "@/lib/weatherForecast";
import { supabase } from "@/lib/supabase";

export type WeatherSnapshot = { tempC: number; code: number; label: string; icon: string };

/** Table de correspondance des codes météo WMO (notre API les déduit des symboles de MET Norway)
 * vers un libellé FR + emoji — volontairement simplifiée (regroupe les
 * variantes "léger/fort" d'une même famille), suffisant pour un aperçu rapide
 * sur une carte de journal, pas pour un bulletin météo détaillé. */
const WMO_LABELS: { codes: number[]; label: string; icon: string }[] = [
  { codes: [0], label: t("Ciel dégagé"), icon: "☀️" },
  { codes: [1, 2, 3], label: t("Nuageux"), icon: "⛅" },
  { codes: [45, 48], label: t("Brouillard"), icon: "🌫️" },
  { codes: [51, 53, 55, 56, 57], label: t("Bruine"), icon: "🌦️" },
  { codes: [61, 63, 65, 66, 67, 80, 81, 82], label: t("Pluie"), icon: "🌧️" },
  { codes: [71, 73, 75, 77, 85, 86], label: t("Neige"), icon: "❄️" },
  { codes: [95, 96, 99], label: t("Orage"), icon: "⛈️" },
];

function labelForCode(code: number): { label: string; icon: string } {
  return WMO_LABELS.find((w) => w.codes.includes(code)) ?? { label: t("Météo"), icon: "🌡️" };
}

/** Échec silencieux (permission refusée, position indisponible) : la météo
 * est un bonus sur une entrée de journal, jamais un blocage à l'enregistrement. */
export async function requestLocationOnce(options: { ask?: boolean } = {}): Promise<{ lat: number; lon: number } | null> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    // Sans `ask`, on ne fait que lire l'autorisation : la demande système ne
    // doit venir que d'un geste de l'utilisateur (CLAUDE.md, jamais sans
    // contexte). Elle apparaissait dès l'ouverture de l'Accueil.
    if (!current.granted && !options.ask) return null;
    // `runNativeInteraction` : la boîte de dialogue de permission Android met
    // notre activité en pause, ce qui rejouerait le verrou biométrique au
    // retour (cf. lib/nativeInteraction.ts). Sans effet sur iOS.
    const granted = current.granted
      ? true
      : (await runNativeInteraction(() => Location.requestForegroundPermissionsAsync())).granted;
    if (!granted) return null;
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    return { lat: position.coords.latitude, lon: position.coords.longitude };
  } catch {
    return null;
  }
}

/** Prévision horaire (MET Norway) via notre serveur, qui la met en cache et
 * respecte les conditions de MET (cf. apps/api/src/lib/weather/metno.ts).
 * Compte non connecté, hors ligne, serveur muet : null, sans erreur. */
async function fetchHours(lat: number, lon: number): Promise<WeatherHour[] | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}${weatherApiPath(lat, lon)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body?.hours) ? (body.hours as WeatherHour[]) : null;
  } catch {
    return null;
  }
}

export async function fetchCurrentWeather(lat: number, lon: number): Promise<WeatherSnapshot | null> {
  const hours = await fetchHours(lat, lon);
  const current = hours ? currentFromHours(hours, new Date()) : null;
  if (!current) return null;
  return { tempC: Math.round(current.tempC), code: current.code, ...labelForCode(current.code) };
}

/** Best-effort complet : position puis météo, null à la moindre étape ratée. */
export async function fetchWeatherSnapshot(): Promise<WeatherSnapshot | null> {
  const position = await requestLocationOnce();
  if (!position) return null;
  return fetchCurrentWeather(position.lat, position.lon);
}

export type DailyForecast = { date: Date; tempMaxC: number; tempMinC: number; code: number; partial: boolean; label: string; icon: string };

/** Prévisions des prochains jours (aperçu indicatif, pas un bulletin détaillé) —
 * pour anticiper les séances/rendez-vous à venir dans le planning. Même
 * permission/position que fetchWeatherSnapshot ; échec silencieux. */
export async function fetchWeatherForecast(maxDays = 5): Promise<DailyForecast[] | null> {
  return (await fetchWeather(maxDays))?.days ?? null;
}

/** Journées ET heures (créneau pour monter, alertes : cf. weather/rideWindow.ts). */
export async function fetchWeather(
  maxDays = 5,
  options: { ask?: boolean } = {}
): Promise<{ days: DailyForecast[]; hours: WeatherHour[] } | null> {
  const position = await requestLocationOnce(options);
  if (!position) return null;
  const hours = await fetchHours(position.lat, position.lon);
  if (!hours) return null;
  const days = dailyFromHours(hours, new Date(), maxDays);
  return days.length > 0 ? { days: days.map((d) => ({ ...d, ...labelForCode(d.code) })), hours } : null;
}

/** L'utilisateur a-t-il déjà répondu à la demande de localisation ?
 * (« undetermined » : l'app peut proposer d'activer la météo.) */
export async function locationPermissionStatus(): Promise<"granted" | "denied" | "undetermined"> {
  try {
    const p = await Location.getForegroundPermissionsAsync();
    return p.granted ? "granted" : p.canAskAgain ? "undetermined" : "denied";
  } catch {
    return "denied";
  }
}
