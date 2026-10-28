import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { useSessions, type TrainingSession } from "@/sessions/store";
import { useHorses, type Horse } from "@/horses/store";
import { ACTIVITY_META } from "@/agenda/store";
import { readJson, writeJson } from "@/lib/localStore";
import { cancelReminder, getNotificationStatus, scheduleSessionReminderNotification } from "@/lib/notifications";
import { hapticSuccess } from "@/lib/haptics";
import { track } from "@/lib/analytics";
import { t } from "@/i18n";
import {
  diffSessionReminders,
  planSessionReminders,
  postponedDate,
  SESSION_ACTION_DONE,
  SESSION_ACTION_TOMORROW,
  SESSION_REMINDER_CATEGORY,
  type StoredReminder,
} from "@/sessions/sessionReminderPlan";

const STORED_KEY = "session_reminders_v1";
const ENABLED_KEY = "session_reminders_enabled_v1";

/** Réglage « Rappels de séance » (Profil). Activé par défaut : il ne fait
 * rien tant que les notifications ne sont pas autorisées. */
export async function getSessionRemindersEnabled(): Promise<boolean> {
  return readJson<boolean>(ENABLED_KEY, true);
}

const syncListeners = new Set<() => void>();

export async function setSessionRemindersEnabled(enabled: boolean): Promise<void> {
  await writeJson(ENABLED_KEY, enabled);
  syncListeners.forEach((listener) => listener());
}

/** Les synchronisations s'enchaînent, jamais en parallèle : deux passes
 * simultanées liraient le même état et programmeraient deux fois. */
let syncChain: Promise<void> = Promise.resolve();

function syncSessionReminders(sessions: TrainingSession[], horses: Horse[]): Promise<void> {
  syncChain = syncChain.then(() => runSync(sessions, horses)).catch(() => {});
  return syncChain;
}

async function runSync(sessions: TrainingSession[], horses: Horse[]): Promise<void> {
  const saved = await readJson<Record<string, StoredReminder>>(STORED_KEY, {});
  // Recoupé avec ce que le système a vraiment en attente : un rappel déjà
  // affiché, ou annulé ailleurs (déconnexion, cf. cancelAllReminders), ne
  // doit pas passer pour encore programmé — il ne serait jamais reprogrammé.
  const pendingIds = new Set(
    (await Notifications.getAllScheduledNotificationsAsync().catch(() => [])).map((n) => n.identifier)
  );
  const stored = Object.fromEntries(Object.entries(saved).filter(([, r]) => pendingIds.has(r.notificationId)));
  const active = (await getSessionRemindersEnabled()) && (await getNotificationStatus());
  const desired = active
    ? planSessionReminders(
        sessions,
        (s) => s.customActivityLabel || ACTIVITY_META[s.activityType].label,
        (horseId) => horses.find((h) => h.id === horseId)?.name ?? null,
        new Date()
      )
    : [];
  const { toCancel, toSchedule, kept } = diffSessionReminders(stored, desired);
  for (const id of toCancel) await cancelReminder(id);
  const next = { ...kept };
  for (const reminder of toSchedule) {
    const notificationId = await scheduleSessionReminderNotification({
      ...reminder,
      category: SESSION_REMINDER_CATEGORY,
      url: "/(tabs)/today",
    });
    if (notificationId) next[reminder.sessionId] = { notificationId, key: reminder.key };
  }
  await writeJson(STORED_KEY, next);
}

/**
 * Rappels de séance : un par séance à venir (cf. sessions/sessionReminders.ts),
 * tenus à jour à chaque changement de séance et à chaque retour dans l'app,
 * et réponse aux deux boutons de la notification.
 *
 * Les boutons rouvrent l'app (`opensAppToForeground`) : c'est le seul moyen
 * fiable d'appliquer l'action quand l'app était fermée, et cocher depuis la
 * notification amène directement à l'invite « Un mot dessus ? ».
 */
export function SessionReminders() {
  const { sessions, loading, toggleCompleted, updateSession } = useSessions();
  const { horses } = useHorses();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    Notifications.setNotificationCategoryAsync(SESSION_REMINDER_CATEGORY, [
      { identifier: SESSION_ACTION_DONE, buttonTitle: t("C'est fait ✓"), options: { opensAppToForeground: true } },
      { identifier: SESSION_ACTION_TOMORROW, buttonTitle: t("Reporter à demain"), options: { opensAppToForeground: true } },
    ]).catch(() => {});
  }, []);

  // Réglage modifié dans Profil, ou retour au premier plan : la fenêtre des
  // 7 jours avance avec le temps, et la permission a pu changer.
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    syncListeners.add(listener);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") listener();
    });
    return () => {
      syncListeners.delete(listener);
      sub.remove();
    };
  }, []);

  // Regroupe les changements rapprochés (plusieurs séances créées d'un coup).
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      syncSessionReminders(sessions, horses).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [sessions, horses, loading, tick]);

  // Boutons de la notification. Les séances sont lues dans une ref pour ne
  // pas réabonner l'écouteur à chaque changement.
  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);
  const handledKeys = useRef(new Set<string>());

  useEffect(() => {
    if (loading) return;
    function handle(response: Notifications.NotificationResponse | null) {
      if (!response) return;
      const action = response.actionIdentifier;
      if (action !== SESSION_ACTION_DONE && action !== SESSION_ACTION_TOMORROW) return;
      const key = `${response.notification.request.identifier}:${action}`;
      if (handledKeys.current.has(key)) return;
      handledKeys.current.add(key);
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
      const sessionId = response.notification.request.content.data?.sessionId;
      const session = sessionsRef.current.find((s) => s.id === sessionId);
      if (!session) return;
      track("session_reminder_action", { action: action === SESSION_ACTION_DONE ? "done" : "tomorrow" });
      if (action === SESSION_ACTION_DONE) {
        if (!session.completed) {
          hapticSuccess();
          toggleCompleted(session.id);
        }
      } else {
        updateSession({ ...session, date: postponedDate(new Date()) });
      }
    }
    Notifications.getLastNotificationResponseAsync()
      .then(handle)
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [loading, toggleCompleted, updateSession]);

  return null;
}
