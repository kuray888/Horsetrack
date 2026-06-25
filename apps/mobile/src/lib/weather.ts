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
