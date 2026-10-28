import * as Notifications from "expo-notifications";
import { supabase } from "@/lib/supabase";
import { readJsonChecked, writeJson } from "@/lib/localStore";
import { track } from "@/lib/analytics";
import { isImmobile } from "@/rides/rideMath";
import { getRideDraft, isRidePaused, onRidePoint, setRideSafety, subscribeRide, type RideDraft } from "@/rides/recorder";
import {
  INITIAL_SAFETY_STATE,
  acknowledgeSafety,
  cleanContacts,
  evaluateSafety,
  shouldSendPosition,
  type SafetyAction,
  type SafetyContact,
  type SafetyState,
} from "@/rides/safetyLogic";
import { t } from "@/i18n";

/**
 * Sécurité en balade (Premium), côté app. Décisions : rides/safetyLogic.ts ;
 * serveur : apps/api/src/lib/rideSafety.ts.
 *
 * Tout passe par les points GPS de l'enregistreur : ils continuent d'arriver
 * écran verrouillé, c'est donc là, et non dans un minuteur (suspendu par iOS
 * en arrière-plan), que l'immobilité est évaluée et la position envoyée.
 */

const SETTINGS_KEY = "ride_safety_v1";
export const SAFETY_CATEGORY = "ride-safety-check";
export const SAFETY_ACTION_OK = "ride-safety-ok";
const CHECK_NOTIFICATION_ID = "ride-safety-check";

/** `riderName` : le prénom que liront les proches (« Léa part à cheval… ») —
 * l'app ne le connaît pas autrement. Gardé sur le téléphone, envoyé
 * seulement au départ d'une balade suivie. */
export type SafetySettings = { enabled: boolean; riderName: string; contacts: SafetyContact[] };

export async function loadSafetySettings(): Promise<SafetySettings> {
  const { value } = await readJsonChecked<SafetySettings | null>(SETTINGS_KEY, null);
  return {
    enabled: value?.enabled ?? false,
    riderName: value?.riderName ?? "",
    contacts: cleanContacts(value?.contacts ?? []),
  };
}

export async function saveSafetySettings(settings: SafetySettings): Promise<void> {
  await writeJson(SETTINGS_KEY, {
    enabled: settings.enabled,
    riderName: settings.riderName.trim().slice(0, 60),
    contacts: cleanContacts(settings.contacts),
  });
}

// --- État observable (bandeau « Tout va bien ? » de l'écran de séance) ------

let state: SafetyState = INITIAL_SAFETY_STATE;
let lastPositionSentAt = 0;
const listeners = new Set<() => void>();

export function getSafetyState(): SafetyState {
  return state;
}

export function subscribeSafety(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setState(next: SafetyState) {
  if (next === state) return;
  state = next;
  for (const l of listeners) l();
}

// --- Appels à l'API ------------------------------------------------------------

async function api(path: string, body: unknown): Promise<Response | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    return await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/ride-safety${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    return null;
  }
}

export type StartSafetyResult =
  | { ok: true; viewUrl: string; emailsSent: number }
  | { ok: false; reason: "premium" | "limit" | "network" };

/** Crée le lien de suivi et l'envoie aux proches (email). */
export async function startRideSafety(input: {
  riderName: string;
  horseName: string;
  contacts: SafetyContact[];
}): Promise<StartSafetyResult> {
  const draft = getRideDraft();
  const last = draft?.points[draft.points.length - 1];
  const res = await api("", {
    riderName: input.riderName,
    horseName: input.horseName,
    contacts: cleanContacts(input.contacts),
    ...(last ? { lat: last.lat, lng: last.lng } : {}),
  });
  if (!res) return { ok: false, reason: "network" };
  if (res.status === 403) return { ok: false, reason: "premium" };
  if (res.status === 429) return { ok: false, reason: "limit" };
  const json = (await res.json().catch(() => null)) as { token?: string; viewUrl?: string; emailsSent?: number } | null;
  if (!res.ok || !json?.token || !json.viewUrl) return { ok: false, reason: "network" };
  setRideSafety({ token: json.token, viewUrl: json.viewUrl });
  state = INITIAL_SAFETY_STATE;
  lastPositionSentAt = last ? Date.now() : 0;
  track("ride_safety_started", { contacts: input.contacts.length, emails_sent: json.emailsSent ?? 0 });
  return { ok: true, viewUrl: json.viewUrl, emailsSent: json.emailsSent ?? 0 };
}

/** Appel à l'aide manuel, depuis l'écran de séance. */
export async function sendManualAlert(): Promise<boolean> {
  const draft = getRideDraft();
  if (!draft?.safety) return false;
  const last = draft.points[draft.points.length - 1];
  const res = await api(`/${draft.safety.token}`, {
    action: "alert",
    reason: "manual",
    lat: last?.lat ?? null,
    lng: last?.lng ?? null,
  });
  const ok = !!res?.ok;
  if (ok) {
    setState({ ...state, alertSent: true, checkStartedAt: null });
    track("ride_safety_alert_sent", { reason: "manual" });
  }
  return ok;
}

/** Fin de balade : le lien affiche « terminée », et les proches sont
 * rassurés s'ils avaient été alertés. */
export async function endRideSafety(safety: RideDraft["safety"]): Promise<void> {
  void Notifications.dismissNotificationAsync(CHECK_NOTIFICATION_ID).catch(() => {});
  void Notifications.cancelScheduledNotificationAsync(CHECK_NOTIFICATION_ID).catch(() => {});
  setState(INITIAL_SAFETY_STATE);
  if (safety) await api(`/${safety.token}`, { action: "end" });
}

/** « Je vais bien » (notification ou bandeau). */
export function acknowledgeSafetyCheck(): void {
  const r = acknowledgeSafety(state, Date.now());
  setState(r.state);
  void runActions(r.actions, getRideDraft());
  track("ride_safety_check", { answer: "ok" });
}

// --- Surveillance ------------------------------------------------------------

async function runActions(actions: SafetyAction[], draft: RideDraft | null): Promise<void> {
  for (const action of actions) {
    if (action === "notify_check") {
      track("ride_safety_check", { answer: "asked" });
      await Notifications.scheduleNotificationAsync({
        identifier: CHECK_NOTIFICATION_ID,
        content: {
          title: t("Tout va bien ?"),
          body: t("Tu n'as pas bougé depuis 5 minutes. Sans réponse d'ici 2 minutes, tes proches seront prévenus."),
          categoryIdentifier: SAFETY_CATEGORY,
          sound: "default",
          data: { url: "/ride" },
        },
        trigger: null,
      }).catch(() => {});
    } else if (action === "cancel_check") {
      await Notifications.dismissNotificationAsync(CHECK_NOTIFICATION_ID).catch(() => {});
    } else if (action === "send_alert" && draft?.safety) {
      const last = draft.points[draft.points.length - 1];
      const res = await api(`/${draft.safety.token}`, {
        action: "alert",
        reason: "immobile",
        lat: last?.lat ?? null,
        lng: last?.lng ?? null,
      });
      if (res?.ok) track("ride_safety_alert_sent", { reason: "immobile" });
    }
  }
}

function evaluate(draft: RideDraft) {
  if (!draft.safety) return;
  const now = Date.now();
  // L'immobilité se compte depuis la reprise : une pause ne compte pas.
  const lastResume = draft.pauses.length ? (draft.pauses[draft.pauses.length - 1].end ?? now) : draft.startedAt;
  const r = evaluateSafety(state, {
    now,
    paused: isRidePaused(draft),
    immobile: isImmobile(draft.points, now, lastResume),
  });
  setState(r.state);
  void runActions(r.actions, draft);

  const last = draft.points[draft.points.length - 1];
  if (last && shouldSendPosition(lastPositionSentAt, now)) {
    lastPositionSentAt = now;
    void api(`/${draft.safety.token}`, { action: "position", lat: last.lat, lng: last.lng, accuracy: last.acc });
  }
}

let started = false;

/** Branché une fois, au démarrage de l'app (cf. app/_layout.tsx). */
export function initRideSafety(): void {
  if (started) return;
  started = true;
  Notifications.setNotificationCategoryAsync(SAFETY_CATEGORY, [
    { identifier: SAFETY_ACTION_OK, buttonTitle: t("Je vais bien"), options: { opensAppToForeground: true } },
  ]).catch(() => {});
  onRidePoint(evaluate);
  // Écran allumé sans nouveau point (GPS perdu sous un abri) : on réévalue
  // quand même, pour que l'alerte parte à l'heure.
  setInterval(() => {
    const draft = getRideDraft();
    if (draft?.safety) evaluate(draft);
  }, 20_000);
  // Séance terminée ailleurs : état remis à zéro.
  subscribeRide(() => {
    if (!getRideDraft() && state !== INITIAL_SAFETY_STATE) setState(INITIAL_SAFETY_STATE);
  });
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (!response) return;
    const id = response.notification.request.identifier;
    if (id !== CHECK_NOTIFICATION_ID) return;
    // Bouton « Je vais bien », ou simple toucher sur la notification : le
    // cavalier a son téléphone en main, il va bien.
    acknowledgeSafetyCheck();
  };
  Notifications.addNotificationResponseReceivedListener(handle);
}
