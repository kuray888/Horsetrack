/**
 * Adresses des requêtes Open-Meteo. La position part chez un prestataire
 * tiers : on n'envoie que ce qu'il faut pour la météo, arrondi à 0,01° (environ
 * 1 km), la maille des modèles météo étant de toute façon plus large. Avant,
 * la position GPS exacte partait telle quelle.
 */
const BASE = "https://api.open-meteo.com/v1/forecast";

export function coarsePosition(lat: number, lon: number): { lat: number; lon: number } {
  const round = (v: number) => Math.round(v * 100) / 100;
  return { lat: round(lat), lon: round(lon) };
}

export function currentWeatherUrl(lat: number, lon: number): string {
  const p = coarsePosition(lat, lon);
  return `${BASE}?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,weather_code`;
}

export function forecastUrl(lat: number, lon: number, days: number): string {
  const p = coarsePosition(lat, lon);
  return `${BASE}?latitude=${p.lat}&longitude=${p.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=${days}&timezone=auto`;
}
