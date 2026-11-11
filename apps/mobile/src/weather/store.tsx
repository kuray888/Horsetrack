import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchWeather, locationPermissionStatus, type DailyForecast } from "@/lib/weather";
import type { WeatherHour } from "@/lib/weatherForecast";
import { bestRideWindow, weatherAlerts } from "@/weather/rideWindow";
import { track } from "@/lib/analytics";
import { isOnboardingCompleted } from "@/onboarding/completion";

/**
 * Prévision météo partagée — un seul fetch pour toute l'app (bande météo sur
 * Today, cf. components/WeatherForecastStrip.tsx, et ajustement automatique
 * du programme par forte chaleur, cf. program/store.tsx) plutôt qu'un appel
 * par consommateur. Récupérée une fois au montage ; pas de rafraîchissement
 * périodique pour l'instant (une session d'app dure rarement assez longtemps
 * pour que la prévision du jour change de façon notable).
 *
 * Ce provider englobe tout l'arbre, y compris l'onboarding/l'auth (cf.
 * app/_layout.tsx) — sans garde, la popup de permission de localisation
 * apparaîtrait dès le tout premier écran, avant même que l'utilisateur ait
 * créé son compte. On ne tente donc le fetch que si l'onboarding est déjà
 * terminé ; un compte qui vient juste de le terminer devra rouvrir l'app une
 * fois pour voir apparaître la météo — compromis acceptable pour une feature
 * d'appoint.
 */

type WeatherContextValue = {
  forecast: DailyForecast[] | null;
  /** Prévision heure par heure (créneau pour monter, alertes). */
  hours: WeatherHour[] | null;
  loading: boolean;
  /** Localisation jamais demandée : l'Accueil propose « Afficher la météo »,
   * qui seul déclenche la demande système (cf. enable). */
  canEnable: boolean;
  enable: () => Promise<void>;
};

const WeatherContext = createContext<WeatherContextValue | null>(null);

export function WeatherProvider({ children }: { children: ReactNode }) {
  const [forecast, setForecast] = useState<DailyForecast[] | null>(null);
  const [hours, setHours] = useState<WeatherHour[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [canEnable, setCanEnable] = useState(false);

  const load = useCallback(async (ask: boolean) => {
    const next = await fetchWeather(5, { ask });
    setForecast(next?.days ?? null);
    setHours(next?.hours ?? null);
    if (next) {
      const now = new Date();
      track("weather_loaded", { ride_window: bestRideWindow(next.hours, now) !== null, alerts: weatherAlerts(next.hours, now).length });
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (!(await isOnboardingCompleted())) return;
        // Jamais de demande système au démarrage : seulement si l'accès est
        // déjà accordé. Sinon l'Accueil propose d'afficher la météo.
        const status = await locationPermissionStatus();
        if (status === "granted") await load(false);
        else setCanEnable(status === "undetermined");
      } catch (e) {
        console.warn("[weather] chargement échoué", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const enable = useCallback(async () => {
    track("weather_enable_tapped");
    setCanEnable(false);
    setLoading(true);
    try {
      await load(true);
    } finally {
      setLoading(false);
    }
  }, [load]);

  const value = useMemo<WeatherContextValue>(
    () => ({ forecast, hours, loading, canEnable, enable }),
    [forecast, hours, loading, canEnable, enable]
  );

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export function useWeather() {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error("useWeather doit être utilisé dans <WeatherProvider>");
  return ctx;
}
