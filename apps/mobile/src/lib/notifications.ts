import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { runNativeInteraction } from "@/lib/nativeInteraction";

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
  // Le canal AVANT la demande de permission, et pas seulement avant l'envoi :
  // sur Android 13+, la permission POST_NOTIFICATIONS se demande au nom des
  // canaux déjà déclarés. Sans canal existant, la demande porte sur une app
  // qui n'annonce aucune notification, et l'écran système des notifications
  // de l'app s'ouvre vide. Créer le canal ici couvre tous les appelants —
  // le réglage du Profil et l'invite de l'écran Accueil, pas seulement
  // `scheduleReminder` plus bas.
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  // `runNativeInteraction` : la boîte de dialogue de permission Android met
  // notre activité en pause, ce qui rejouerait le verrou biométrique au retour
  // (cf. lib/nativeInteraction.ts). Sans effet sur iOS.
  const requested = await runNativeInteraction(() => Notifications.requestPermissionsAsync());
  return requested.granted;
}

/** Lit l'état actuel de la permission sans en redemander une (pour affichage seul). */
export async function getNotificationStatus(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  return current.granted;
}

/** État détaillé, sans rien demander :
 * - "granted" : autorisées ;
 * - "undetermined" : jamais demandé — la demande système peut encore
 *   s'afficher, à déclencher sur une action de l'utilisateur, avec une raison ;
 * - "denied" : refusées — l'OS ne réaffichera plus sa demande, seuls les
 *   réglages du téléphone peuvent les réactiver. */
export type NotificationPermissionState = "granted" | "undetermined" | "denied";

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return "granted";
  return current.canAskAgain ? "undetermined" : "denied";
}

/** Identifiant du canal Android de tous les rappels de l'app. Doit être passé
 * explicitement à chaque notification programmée (cf. `scheduleReminder`) :
 * sans lui, expo-notifications range la notification dans son canal de
 * repli « Miscellaneous » (cf. BaseNotificationBuilder.FALLBACK_CHANNEL_ID),
 * et le canal « Rappels » créé ici ne sert jamais — l'utilisateur qui règle
 * ses notifications depuis Android agit alors sur un canal vide. */
const CHANNEL_ID = "default";

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Rappels",
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** Nombre de rappels locaux déjà programmés et pas encore déclenchés.
 *
 * Sert à prévenir avant d'en créer une fournée de plus (cf.
 * lib/notificationBudget.ts) : iOS n'en garde que 64 et jette le reste sans
 * rien dire. Retourne 0 si la liste est illisible — mieux vaut ne pas
 * avertir que bloquer une création sur une lecture ratée. */
export async function pendingReminderCount(): Promise<number> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.length;
  } catch (e) {
    console.warn("[notifications] lecture des rappels programmés échouée", e);
    return 0;
  }
}

/** Programme un rappel local ; retourne l'id (à conserver pour pouvoir l'annuler), ou null si non programmé. */
export async function scheduleReminder(title: string, body: string, trigger: Date): Promise<string | null> {
  const granted = await ensureNotificationPermission();
  if (!granted) return null;
  await ensureAndroidChannel();
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    // `channelId` est ignoré sur iOS (cf. les types d'expo-notifications) et
    // décisif sur Android : cf. le commentaire de CHANNEL_ID plus haut.
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger, channelId: CHANNEL_ID },
  });
}

/** Best-effort, comme cancelEmailReminder (cf. lib/emailReminders.ts) : appelé
 * en fire-and-forget (sans await) depuis plusieurs endroits (édition/
 * suppression de rendez-vous, cf. agenda/store.tsx et useAppointmentForm.ts)
 * — un id devenu invalide (notification déjà déclenchée/annulée par l'OS,
 * permission révoquée) ne doit jamais devenir un rejet de promesse non
 * intercepté, qui plante silencieusement l'app (cf. audit crash du
 * 2026-09-05, rendez-vous santé). */
export async function cancelReminder(id: string | null | undefined): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // ignoré : voir commentaire ci-dessus.
  }
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
 *
 * Reprogrammé dès que les chiffres de la semaine changent : le texte d'une
 * notification locale est figé au moment où on la programme. L'ancienne
 * version ne la programmait qu'une fois par semaine, avec les chiffres du
 * premier affichage de l'Accueil — le dimanche, on lisait « 0/4 séances »
 * même après une semaine complète.
 *
 * Ne DEMANDE jamais la permission : appelée au montage de l'Accueil, elle
 * déclenchait la demande système dès la première ouverture de l'app, sans
 * explication (un refus y est quasi définitif). La demande se fait désormais
 * sur action de l'utilisateur, avec sa raison (carte de l'Accueil, écran de
 * bienvenue Premium, création d'un rappel).
 */
/** Best-effort de bout en bout (cf. cancelReminder ci-dessus et audit crash
 * SecureStore du 2026-09-08) : appelée en fire-and-forget sans catch depuis
 * (tabs)/today.tsx à chaque affichage de l'écran, une exception ici ne doit
 * jamais devenir un rejet de promesse non intercepté. */
export async function scheduleWeeklySummary(
  horseName: string,
  done: number,
  total: number
): Promise<void> {
  try {
    if (!(await getNotificationStatus())) return;

    const weekStart = currentWeekStart();

    // Déjà programmée pour cette semaine avec ces mêmes chiffres : rien à faire.
    const raw = await SecureStore.getItemAsync(WEEKLY_SUMMARY_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { id: string; weekStart: string; done?: number; total?: number; horseName?: string };
      if (saved.weekStart === weekStart && saved.done === done && saved.total === total && saved.horseName === horseName) {
        return;
      }
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
      await SecureStore.setItemAsync(WEEKLY_SUMMARY_KEY, JSON.stringify({ id, weekStart, done, total, horseName }));
    }
  } catch {
    // Best-effort : voir commentaire ci-dessus.
  }
}

/** Annule le bilan hebdomadaire (suppression de compte, déconnexion…). */
export async function cancelWeeklySummary(): Promise<void> {
  try {
    const raw = await SecureStore.getItemAsync(WEEKLY_SUMMARY_KEY);
    if (!raw) return;
    const { id } = JSON.parse(raw) as { id: string };
    await cancelReminder(id);
    await SecureStore.deleteItemAsync(WEEKLY_SUMMARY_KEY);
  } catch {
    // Best-effort : voir cancelReminder ci-dessus.
  }
}
