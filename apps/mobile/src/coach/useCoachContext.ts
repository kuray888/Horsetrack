import { useMemo } from "react";
import type { Horse } from "@/horses/store";
import { useSessions } from "@/sessions/store";
import { useAgenda } from "@/agenda/store";
import { useWeight } from "@/horses/weightStore";
import { useWeather } from "@/weather/store";
import { useRiderProfile } from "@/rider/store";
import { useHorseDetails } from "@/extras/store";
import { LANG } from "@/i18n";
import type { CoachContext } from "@/coach/facts";

/**
 * Données d'un cheval pour le coach, tirées des stores de l'app (donc à jour
 * même hors ligne). Rien n'est envoyé ici : les modules purs de coach/ en
 * tirent les faits, sans nom ni texte libre.
 */
export function useCoachContext(horse: Horse | null): CoachContext | null {
  const { sessions } = useSessions();
  const { appointments, journal, expenses } = useAgenda();
  const { measurements } = useWeight();
  const { forecast } = useWeather();
  const { riderProfile } = useRiderProfile();
  const details = useHorseDetails(horse?.id);

  return useMemo(() => {
    if (!horse) return null;
    const mine = <T extends { horseId: string | null }>(list: T[]) => list.filter((x) => x.horseId === horse.id);
    return {
      now: new Date(),
      lang: LANG,
      horse,
      rider: { level: riderProfile.level, goal: riderProfile.primaryGoal, discipline: riderProfile.mainDiscipline },
      sessions: mine(sessions).map((s) => ({
        date: s.date,
        activityType: s.activityType,
        durationMinutes: s.durationMinutes,
        intensity: s.intensity,
        completed: s.completed,
        ride: s.ride ?? null,
      })),
      appointments: mine(appointments).map((a) => ({
        type: a.type,
        date: a.date,
        endDate: a.endDate ?? null,
        nextDueDate: a.nextDueDate,
        competitionLevel: a.competitionLevel ?? null,
        cost: a.cost ?? null,
        result: a.result,
      })),
      journal: mine(journal).map((j) => ({ date: j.date, mood: j.mood })),
      expenses: mine(expenses).map((e) => ({ date: e.date, category: e.category, amount: e.amount })),
      weights: measurements.filter((m) => m.horseId === horse.id).map((m) => ({ date: m.date, weightKg: m.weightKg })),
      forecast: forecast ?? null,
      partnerDays: details?.partnership.riderName.trim() ? details.partnership.days : [],
    };
  }, [horse, sessions, appointments, journal, expenses, measurements, forecast, riderProfile, details]);
}
