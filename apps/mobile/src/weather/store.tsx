import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchWeatherForecast, type DailyForecast } from "@/lib/weather";
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
  loading: boolean;
};

const WeatherContext = createContext<WeatherContextValue | null>(null);

export function WeatherProvider({ children }: { children: ReactNode }) {
  const [forecast, setForecast] = useState<DailyForecast[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (!(await isOnboardingCompleted())) return;
        const next = await fetchWeatherForecast(5);
        setForecast(next);
      } catch (e) {
        console.warn("[weather] chargement échoué", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<WeatherContextValue>(() => ({ forecast, loading }), [forecast, loading]);

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export function useWeather() {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error("useWeather doit être utilisé dans <WeatherProvider>");
  return ctx;
}
