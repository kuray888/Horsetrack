import { useEffect, useMemo } from "react";
import { pushWidgetData } from "@/lib/widgetKit";
import { buildWidgetData } from "@/lib/widgetData";
import { isSameDate } from "@/lib/dateFormat";
import { ACTIVITY_META, type Appointment } from "@/agenda/store";
import type { Horse } from "@/horses/store";
import type { TrainingSession } from "@/sessions/store";
import { buildUnifiedEvents, upcomingUnifiedEvents } from "@/planning/unifiedEvents";
import { buildHorseAlerts } from "@/horses/alerts";
import { HEALTH_APPOINTMENT_TYPES, weeklyStreak } from "@/lib/progress";
import { upcomingEventMeta } from "@/today/upcomingEventMeta";

/**
 * Ce que l'Accueil affiche du cheval actif : la séance et les événements du
 * jour, la semaine, ce qui arrive ensuite, les points à surveiller (tous
 * chevaux). Sorti de app/(tabs)/today.tsx, calculs inchangés.
 */
export function useTodayOverview({
  horse,
  horses,
  sessions,
  appointments,
  today,
}: {
  horse: Horse | null;
  horses: Horse[];
  sessions: TrainingSession[];
  appointments: Appointment[];
  /** Fixé une fois par montage (cf. today.tsx). */
  today: Date;
}) {
  const todayStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()), [today]);
  // 0 = lundi ... 6 = dimanche (même convention qu'ailleurs dans l'app).
  const todayDayOffset = useMemo(() => (today.getDay() + 6) % 7, [today]);

  const horseSessions = useMemo(() => sessions.filter((s) => s.horseId === horse?.id), [sessions, horse?.id]);
  const todaySession = useMemo(
    () => horseSessions.find((s) => isSameDate(s.date, todayStart)) ?? null,
    [horseSessions, todayStart]
  );

  const weekStart = useMemo(() => {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - todayDayOffset);
    return d;
  }, [todayStart, todayDayOffset]);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    return d;
  }, [weekStart]);
  const weekSessions = useMemo(
    () => horseSessions.filter((s) => s.date >= weekStart && s.date < weekEnd),
    [horseSessions, weekStart, weekEnd]
  );
  const weekDoneCount = useMemo(() => weekSessions.filter((s) => s.completed).length, [weekSessions]);
  // Semaines consécutives avec au moins une séance faite (cf. lib/progress.ts).
  const streak = useMemo(() => (horse ? weeklyStreak(sessions, horse.id, today) : 0), [sessions, horse, today]);
  const hasHealthAppointment = useMemo(
    () => !!horse && appointments.some((a) => a.horseId === horse.id && HEALTH_APPOINTMENT_TYPES.has(a.type)),
    [appointments, horse]
  );

  // "Prochains événements" : séances + rendez-vous du cheval actif fusionnés
  // par le même système que Planning (cf. plan Phase 3 Étape 3) — aucune
  // deuxième logique de calendrier, juste les 3 premiers ici.
  const horseAppointments = useMemo(
    () => appointments.filter((a) => a.horseId === horse?.id),
    [appointments, horse?.id]
  );
  const upcoming = useMemo(
    () => upcomingUnifiedEvents(buildUnifiedEvents(horseSessions, horseAppointments), todayStart),
    [horseSessions, horseAppointments, todayStart]
  );
  // Le même événement ne doit apparaître qu'à un seul endroit : ce qui tombe
  // aujourd'hui vit dans le bloc « Aujourd'hui » (où il est actionnable), le
  // reste dans « Prochainement ». Avant, la séance du jour s'affichait à la
  // fois dans le bouton d'action et dans la liste des prochains événements.
  const todayEvents = useMemo(() => upcoming.filter((e) => isSameDate(e.date, todayStart)), [upcoming, todayStart]);
  const laterEvents = useMemo(
    () => upcoming.filter((e) => !isSameDate(e.date, todayStart)).slice(0, 3),
    [upcoming, todayStart]
  );
  /** Première échéance à venir — sert à l'état vide : « rien aujourd'hui » ne
   * veut pas dire « rien à faire », et une journée libre est justement le
   * moment où l'on veut voir ce qui arrive ensuite. */
  const nextEvent = laterEvents[0] ?? null;

  // Alertes (cf. plan Phase 3 Étape 4 §6) : toutes les écuries, pas
  // seulement le cheval actif — une alerte peut concerner un autre cheval.
  const alerts = useMemo(() => buildHorseAlerts(horses, appointments, todayStart), [horses, appointments, todayStart]);

  // Widget iOS : la séance du jour, la semaine, le prochain événement et le
  // nombre de points à surveiller — réécrit dès que l'un d'eux change
  // (pushWidgetData ignore les écritures identiques, cf. lib/widgetKit.ts).
  useEffect(() => {
    void pushWidgetData(
      buildWidgetData({
        today: todayStart,
        horseName: horse?.name ?? null,
        todaySession: todaySession
          ? {
              title: todaySession.customActivityLabel || ACTIVITY_META[todaySession.activityType].label,
              durationMinutes: todaySession.durationMinutes,
              time: todaySession.time,
              completed: todaySession.completed,
            }
          : null,
        weeklyDone: weekDoneCount,
        weeklyTotal: weekSessions.length,
        nextEvent: nextEvent
          ? {
              title: upcomingEventMeta(nextEvent).title,
              date: nextEvent.date,
              time: nextEvent.kind === "session" ? nextEvent.session.time : nextEvent.appointment.time,
            }
          : null,
        alertsCount: alerts.length,
      })
    );
  }, [horse?.name, todayStart, todaySession, weekDoneCount, weekSessions.length, nextEvent, alerts.length]);

  return {
    todayStart,
    horseSessions,
    horseAppointments,
    weekSessions,
    weekDoneCount,
    streak,
    hasHealthAppointment,
    todayEvents,
    laterEvents,
    nextEvent,
    alerts,
  };
}
