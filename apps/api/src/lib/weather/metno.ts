/**
 * Prévisions MET Norway (Locationforecast 2.0, institut météorologique
 * norvégien) : données ouvertes sous licences NLOD 2.0 et CC BY 4.0, usage
 * commercial permis, attribution « MET Norway » obligatoire (affichée dans
 * l'app). Remplace l'accès gratuit d'Open-Meteo, réservé au non commercial.
 *
 * Conditions de MET (https://api.met.no/doc/TermsOfService) respectées ici :
 * les apps passent par notre serveur (jamais en direct), qui s'identifie
 * (User-Agent), garde les réponses jusqu'à `Expires`, redemande avec
 * `If-Modified-Since`, et n'envoie que des coordonnées arrondies.
 *
 * Logique pure (sans réseau) : testée dans metno.test.ts.
 */

export type WeatherHour = {
  /** Heure UTC (ISO). L'app regroupe par jour dans son propre fuseau. */
  time: string;
  tempC: number;
  /** Code WMO, comme Open-Meteo : c'est ce que lisent l'app et le coach. */
  code: number;
  precipMm: number | null;
  windKmh: number | null;
};

/** Symboles MET (sans suffixe _day / _night / _polartwilight) → code WMO. */
const SYMBOL_TO_WMO: Record<string, number> = {
  clearsky: 0,
  fair: 1,
  partlycloudy: 2,
  cloudy: 3,
  fog: 45,
  lightrain: 61,
  rain: 63,
  heavyrain: 65,
  lightrainshowers: 80,
  rainshowers: 81,
  heavyrainshowers: 82,
  // Grésil : rangé avec la pluie verglaçante, le coach y voit un sol glissant.
  lightsleet: 66,
  sleet: 67,
  heavysleet: 67,
  lightsleetshowers: 66,
  sleetshowers: 67,
  heavysleetshowers: 67,
  lightsnow: 71,
  snow: 73,
  heavysnow: 75,
  lightsnowshowers: 85,
  snowshowers: 85,
  heavysnowshowers: 86,
};

export function symbolToWmo(symbol: string | undefined): number {
  if (!symbol) return 3;
  const base = symbol.replace(/_(day|night|polartwilight)$/, "");
  if (base.endsWith("thunder")) return 95;
  return SYMBOL_TO_WMO[base] ?? 3;
}

type Json = Record<string, unknown> | null | undefined;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Record<string, unknown>) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function parseLocationforecast(body: unknown): WeatherHour[] {
  const series = obj(obj(body)?.properties)?.timeseries;
  if (!Array.isArray(series)) return [];
  const hours: WeatherHour[] = [];
  for (const entry of series) {
    const e = obj(entry);
    const data = obj(e?.data);
    const instant = obj(obj(data?.instant)?.details);
    const next = obj(data?.next_1_hours) ?? obj(data?.next_6_hours);
    const tempC = num(instant?.air_temperature);
    const symbol = obj(next?.summary)?.symbol_code;
    if (typeof e?.time !== "string" || tempC === null || typeof symbol !== "string") continue;
    const wind = num(instant?.wind_speed);
    hours.push({
      time: e.time,
      tempC,
      code: symbolToWmo(symbol),
      precipMm: num(obj(next?.details)?.precipitation_amount),
      windKmh: wind === null ? null : Math.round(wind * 3.6),
    });
  }
  return hours;
}

/** Position arrondie à 0,01° (≈ 1 km) : sert de clé de cache et seule elle
 * part chez MET. Null si la position n'est pas valide. */
export function cacheKey(lat: number, lon: number): { key: string; lat: number; lon: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const r = (v: number) => Math.round(v * 100) / 100;
  return { key: `${r(lat)},${r(lon)}`, lat: r(lat), lon: r(lon) };
}
