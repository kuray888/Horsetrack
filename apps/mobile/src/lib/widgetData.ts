import { isoDay } from "@/lib/dateFormat";
import { t as tr } from "@/i18n";

/**
 * Données du widget iOS — miroir exact de `WidgetData` dans
 * targets/horsetrack-widget/HorsetrackWidget.swift : un champ ajouté ici doit
 * l'être là-bas (optionnel côté Swift, pour relire sans erreur ce qu'une
 * ancienne version de l'app a écrit).
 *
 * Les dates voyagent en « AAAA-MM-JJ » et non en libellé (« Demain ») : le
 * widget s'affiche des heures après l'écriture, parfois le lendemain, sans
 * que l'app soit rouverte. C'est lui qui compare au jour réel, et masque la
 * séance du jour quand ce n'est plus le jour.
 */
export type WidgetData = {
  /** Jour auquel se rapportent `todaySession*` et la progression. */
  day: string;
  horseName: string;
  todaySessionTitle: string | null;
  todaySessionDurationMin: number | null;
  todaySessionTime: string | null;
  todaySessionDone: boolean;
  weeklyDone: number;
  weeklyTotal: number;
  nextEventTitle: string | null;
  nextEventDay: string | null;
  nextEventTime: string | null;
  alertsCount: number;
};

export type WidgetSource = {
  today: Date;
  horseName: string | null;
  todaySession: { title: string; durationMinutes: number | null; time: string; completed: boolean } | null;
  weeklyDone: number;
  weeklyTotal: number;
  nextEvent: { title: string; date: Date; time: string } | null;
  alertsCount: number;
};

export function buildWidgetData(src: WidgetSource): WidgetData {
  const time = (t: string | undefined) => (t && t.trim() ? t.trim() : null);
  return {
    day: isoDay(src.today),
    horseName: src.horseName?.trim() || tr("Mon cheval"),
    todaySessionTitle: src.todaySession?.title ?? null,
    todaySessionDurationMin: src.todaySession?.durationMinutes ?? null,
    todaySessionTime: time(src.todaySession?.time),
    todaySessionDone: src.todaySession?.completed ?? false,
    weeklyDone: src.weeklyDone,
    weeklyTotal: src.weeklyTotal,
    nextEventTitle: src.nextEvent?.title ?? null,
    nextEventDay: src.nextEvent ? isoDay(src.nextEvent.date) : null,
    nextEventTime: time(src.nextEvent?.time),
    alertsCount: src.alertsCount,
  };
}
