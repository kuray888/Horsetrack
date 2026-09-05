import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const WEEKLY_SUMMARY_KEY = "weekly_summary_notif_v1";

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

/** Prochain dimanche à 19h00 — ou ce dimanche si on est avant 19h. */
function nextSunday19h(): Date {
  const now = new Date();
  const day = now.getDay(); // 0 = dimanche
  const daysUntil = day === 0 ? (now.getHours() < 19 ? 0 : 7) : 7 - day;
  const target = new Date(now);
  target.setDate(now.getDate() + daysUntil);
  target.setHours(19, 0, 0, 0);
  return target;
}

/** Lundi de la semaine courante (pour la clé de déduplication). */
function currentWeekStart(): string {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

/**
 * Programme le bilan hebdomadaire du dimanche soir.
 * Idempotent sur la semaine : un seul appel effectif par semaine même si
 * Today se remonte plusieurs fois — la notification existante est conservée
 * jusqu'au prochain changement de semaine.
 */
export async function scheduleWeeklySummary(
  horseName: string,
  done: number,
  total: number
): Promise<void> {
  if (!(await ensureNotificationPermission())) return;

  const weekStart = currentWeekStart();

  // Vérifie si une notification est déjà prévue pour cette semaine.
  const raw = await SecureStore.getItemAsync(WEEKLY_SUMMARY_KEY);
  if (raw) {
    const saved = JSON.parse(raw) as { id: string; weekStart: string };
    if (saved.weekStart === weekStart) return;
    await cancelReminder(saved.id);
  }

  const trigger = nextSunday19h();

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  let suffix: string;
  if (total === 0) {
    suffix = "Pas de séance prévue cette semaine.";
  } else if (done === total) {
    suffix = "Semaine parfaite — exceptionnel ! 🎉";
  } else if (pct >= 60) {
    suffix = "Super semaine, continue comme ça ! ⭐";
  } else if (done > 0) {
    suffix = "Tu peux encore finir en beauté 💪";
  } else {
    suffix = "La semaine n'est pas finie, à toi de jouer ! 🏇";
  }

  const body = total > 0 ? `${done}/${total} séances — ${suffix}` : suffix;

  const id = await scheduleReminder(
    `Bilan de la semaine avec ${horseName}`,
    body,
    trigger
  );

  if (id) {
    await SecureStore.setItemAsync(WEEKLY_SUMMARY_KEY, JSON.stringify({ id, weekStart }));
  }
}

/** Annule le bilan hebdomadaire (suppression de compte, déconnexion…). */
export async function cancelWeeklySummary(): Promise<void> {
  const raw = await SecureStore.getItemAsync(WEEKLY_SUMMARY_KEY);
  if (!raw) return;
  const { id } = JSON.parse(raw) as { id: string };
  await cancelReminder(id);
  await SecureStore.deleteItemAsync(WEEKLY_SUMMARY_KEY);
}
