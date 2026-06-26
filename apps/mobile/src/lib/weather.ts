import * as Location from "expo-location";

export type WeatherSnapshot = { tempC: number; code: number; label: string; icon: string };

/** Table de correspondance des codes météo WMO (norme utilisée par Open-Meteo)
 * vers un libellé FR + emoji — volontairement simplifiée (regroupe les
 * variantes "léger/fort" d'une même famille), suffisant pour un aperçu rapide
 * sur une carte de journal, pas pour un bulletin météo détaillé. */
const WMO_LABELS: { codes: number[]; label: string; icon: string }[] = [
  { codes: [0], label: "Ciel dégagé", icon: "☀️" },
  { codes: [1, 2, 3], label: "Nuageux", icon: "⛅" },
  { codes: [45, 48], label: "Brouillard", icon: "🌫️" },
  { codes: [51, 53, 55, 56, 57], label: "Bruine", icon: "🌦️" },
  { codes: [61, 63, 65, 66, 67, 80, 81, 82], label: "Pluie", icon: "🌧️" },
  { codes: [71, 73, 75, 77, 85, 86], label: "Neige", icon: "❄️" },
  { codes: [95, 96, 99], label: "Orage", icon: "⛈️" },
];

function labelForCode(code: number): { label: string; icon: string } {
  return WMO_LABELS.find((w) => w.codes.includes(code)) ?? { label: "Météo", icon: "🌡️" };
}

/** Échec silencieux (permission refusée, position indisponible) : la météo
 * est un bonus sur une entrée de journal, jamais un blocage à l'enregistrement. */
export async function requestLocationOnce(): Promise<{ lat: number; lon: number } | null> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    const granted = current.granted ? true : (await Location.requestForegroundPermissionsAsync()).granted;
    if (!granted) return null;
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    return { lat: position.coords.latitude, lon: position.coords.longitude };
  } catch {
    return null;
  }
}

/** Open-Meteo : API météo gratuite, sans clé. */
export async function fetchCurrentWeather(lat: number, lon: number): Promise<WeatherSnapshot | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const tempC = data?.current?.temperature_2m;
    const code = data?.current?.weather_code;
    if (typeof tempC !== "number" || typeof code !== "number") return null;
    return { tempC, code, ...labelForCode(code) };
  } catch {
    return null;
  }
}

/** Best-effort complet : position puis météo, null à la moindre étape ratée. */
export async function fetchWeatherSnapshot(): Promise<WeatherSnapshot | null> {
  const position = await requestLocationOnce();
  if (!position) return null;
  return fetchCurrentWeather(position.lat, position.lon);
}

export type DailyForecast = { date: Date; tempMaxC: number; tempMinC: number; code: number; label: string; icon: string };

/** Parse une date "YYYY-MM-DD" (renvoyée par Open-Meteo) en date locale —
 * éviter `new Date("YYYY-MM-DD")`, qui est interprété en UTC minuit et peut
 * tomber sur la veille une fois reconverti en jour de semaine local dans un
 * fuseau négatif (ex: US). */
function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Prévisions des prochains jours (aperçu indicatif, pas un bulletin détaillé) —
 * pour anticiper les séances/rendez-vous à venir dans le planning. Même
 * permission/position que fetchWeatherSnapshot ; échec silencieux. */
export async function fetchWeatherForecast(days = 5): Promise<DailyForecast[] | null> {
  const position = await requestLocationOnce();
  if (!position) return null;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${position.lat}&longitude=${position.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=${days}&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const dates = data?.daily?.time;
    const codes = data?.daily?.weather_code;
    const maxs = data?.daily?.temperature_2m_max;
    const mins = data?.daily?.temperature_2m_min;
    if (!Array.isArray(dates) || !Array.isArray(codes) || !Array.isArray(maxs) || !Array.isArray(mins)) return null;
    return dates.map((isoDate: string, i: number) => ({
      date: parseLocalDate(isoDate),
      tempMaxC: Math.round(maxs[i]),
      tempMinC: Math.round(mins[i]),
      code: codes[i],
      ...labelForCode(codes[i]),
    }));
  } catch {
    return null;
  }
}
