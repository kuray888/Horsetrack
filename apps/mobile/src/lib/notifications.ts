import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export type ReminderOption = "none" | "1h" | "1d" | "1w";

const REMINDER_OFFSET_MS: Record<Exclude<ReminderOption, "none">, number> = {
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
};

/** Horaire par défaut si le texte libre (ex "14h30") ne se parse pas. */
function parseTime(time: string): { hour: number; minute: number } {
  const match = time.match(/(\d{1,2})\s*h\s*(\d{1,2})?/i);
  if (!match) return { hour: 9, minute: 0 };
  return {
    hour: Math.min(23, parseInt(match[1], 10)),
    minute: match[2] ? Math.min(59, parseInt(match[2], 10)) : 0,
  };
}

/** Date de déclenchement du rappel, ou null si "Aucun" ou si déjà passé. */
export function computeReminderTrigger(date: Date, time: string, reminder: ReminderOption): Date | null {
  if (reminder === "none") return null;
  const { hour, minute } = parseTime(time);
  const apptDateTime = new Date(date);
  apptDateTime.setHours(hour, minute, 0, 0);
  const trigger = new Date(apptDateTime.getTime() - REMINDER_OFFSET_MS[reminder]);
  return trigger.getTime() > Date.now() ? trigger : null;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Lit l'état actuel de la permission sans en redemander une (pour affichage seul). */
export async function getNotificationStatus(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  return current.granted;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Rappels",
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** Programme un rappel local ; retourne l'id (à conserver pour pouvoir l'annuler), ou null si non programmé. */
export async function scheduleReminder(title: string, body: string, trigger: Date): Promise<string | null> {
  const granted = await ensureNotificationPermission();
  if (!granted) return null;
  await ensureAndroidChannel();
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
  });
}

export async function cancelReminder(id: string | null | undefined): Promise<void> {
  if (!id) return;
  await Notifications.cancelScheduledNotificationAsync(id);
}
