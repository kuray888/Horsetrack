/**
 * « Il va pleuvoir sur ta séance de demain. »
 *
 * Les prévisions existaient déjà (bandeau indicatif de l'Accueil, cf.
 * components/WeatherForecastStrip.tsx) et les séances aussi, mais les deux
 * ne se parlaient pas : il fallait voir la pluie annoncée, se souvenir de ce
 * qui était prévu ce jour-là, et faire le rapprochement soi-même.
 *
 * Module pur, sans dépendance à react-native ni au réseau (même précaution
 * que horses/selectableHorses.ts) : la règle se teste sans prévision réelle.
 *
 * Ce n'est PAS un bulletin : on ne prévient que pour ce qui change vraiment
 * une séance à cheval, et seulement quand la prévision existe.
 */

/** Ce dont la règle a besoin d'une prévision (cf. lib/weather.ts DailyForecast). */
export type ForecastLike = { date: Date; code: number; label: string; icon: string; tempMinC: number; tempMaxC: number };

/** Ce dont la règle a besoin d'une séance. */
export type PlannedLike = { date: Date; completed: boolean };

/**
 * Codes WMO qui méritent un avertissement avant de monter — pluie, averses,
 * neige, orage, verglas. Volontairement PAS la bruine (51-57) ni le
 * brouillard : on monte sous la bruine, et prévenir pour tout reviendrait à
 * ne prévenir pour rien.
 *
 * Cf. WMO_LABELS dans lib/weather.ts, d'où viennent ces codes.
 */
const ALERT_CODES = new Set([
  61, 63, 65, 66, 67, // pluie, pluie verglaçante
  80, 81, 82, // averses
  71, 73, 75, 77, 85, 86, // neige
  95, 96, 99, // orage
]);

/** Au-delà, une prévision journalière ne dit plus grand-chose d'utile — et
 * Open-Meteo n'en renvoie que cinq jours (cf. fetchWeatherForecast). */
export const ALERT_HORIZON_DAYS = 3;

/** Température en dessous de laquelle on signale le froid, même par beau
 * temps : sous zéro, le sol gèle et la carrière devient impraticable. */
export const FREEZING_MAX_C = 0;

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/**
 * Avertissement à afficher pour la prochaine séance prévue, ou `null`.
 *
 * `null` dans tous les cas où l'on n'a rien de sûr à dire : pas de prévision
 * (position refusée, réseau coupé), séance passée ou déjà faite, séance
 * au-delà de l'horizon, ou météo sans conséquence. Mieux vaut ne rien
 * afficher qu'un avertissement inventé.
 */
export function sessionWeatherWarning(
  sessions: PlannedLike[],
  forecast: ForecastLike[] | null,
  today: Date
): { date: Date; message: string; icon: string } | null {
  if (!forecast || forecast.length === 0) return null;

  const horizon = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  horizon.setDate(horizon.getDate() + ALERT_HORIZON_DAYS);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // La PROCHAINE séance concernée, pas toutes : un écran qui énumère trois
  // avertissements n'en fait lire aucun.
  const next = sessions
    .filter((s) => !s.completed && s.date >= todayStart && s.date <= horizon)
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
  if (!next) return null;

  const day = forecast.find((f) => isSameDay(f.date, next.date));
  if (!day) return null;

  if (ALERT_CODES.has(day.code)) {
    return {
      date: next.date,
      icon: day.icon,
      message: `${day.label.toLowerCase()} annoncé${day.label.endsWith("e") ? "e" : ""} (${day.tempMinC}° à ${day.tempMaxC}°)`,
    };
  }
  if (day.tempMaxC <= FREEZING_MAX_C) {
    return {
      date: next.date,
      icon: "🥶",
      message: `gel annoncé (${day.tempMinC}° à ${day.tempMaxC}°)`,
    };
  }
  return null;
}
