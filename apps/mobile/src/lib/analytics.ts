import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { supabase } from "@/lib/supabase";

/**
 * Analytics produit first-party (entonnoir onboarding → paywall → essai →
 * abonnement), envoyées à PostHog par son API HTTP `/batch/` — volontairement
 * sans SDK : aucune dépendance native (donc aucun rebuild), aucun identifiant
 * publicitaire (pas d'IDFA, pas de demande ATT), aucune donnée personnelle
 * dans les propriétés (jamais d'email ni de nom de cheval).
 *
 * Inactif tant que `EXPO_PUBLIC_POSTHOG_KEY` n'est pas renseignée : `track()`
 * ne fait alors rien (log console en dev seulement). Hôte par défaut : région
 * UE de PostHog (`EXPO_PUBLIC_POSTHOG_HOST` pour en changer).
 *
 * Best-effort de bout en bout : aucune fonction exportée ne rejette ni ne
 * bloque l'UI — un événement perdu vaut mieux qu'un écran planté.
 */

const API_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = (process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com").replace(/\/$/, "");
const ANON_ID_KEY = "analytics_anon_id_v1";
const FLUSH_INTERVAL_MS = 10_000;
const FLUSH_AT = 20;

export type AnalyticsEvent =
  // Onboarding
  | "onboarding_step_viewed"
  | "onboarding_completed"
  // Paywall
  | "paywall_viewed"
  | "paywall_plan_selected"
  | "paywall_cta_tapped"
  | "paywall_dismissed"
  | "paywall_compare_opened"
  | "free_tier_chosen"
  | "locked_feature_tapped"
  // Achat
  | "purchase_started"
  | "purchase_completed"
  | "purchase_cancelled"
  | "purchase_failed"
  | "restore_tapped"
  | "restore_completed"
  | "promo_code_submitted"
  | "promo_code_result"
  | "promo_store_redeem_opened"
  | "winback_offer_viewed"
  | "winback_offer_tapped"
  | "winback_offer_dismissed"
  // Coach IA
  | "coach_session_planned"
  | "coach_question_asked"
  | "coach_summary_viewed"
  // Fil privé d'un cheval
  | "comment_posted"
  | "comment_reported"
  | "reaction_added"
  // Bibliothèque d'exercices
  | "exercise_added_to_session"
  | "exercise_favorited"
  | "manage_subscription_opened"
  // Après achat
  | "premium_welcome_viewed"
  | "premium_welcome_action"
  | "trial_reminder_scheduled"
  | "upsell_card_viewed"
  | "upsell_card_dismissed"
  // Activation
  | "horse_added"
  | "reminder_created"
  | "document_added"
  | "share_invite_sent"
  | "share_invite_message_opened"
  | "horse_shared"
  | "monthly_recap_shared"
  | "milestone_shared"
  | "milestone_unlocked"
  | "app_recommended"
  | "review_prompt_requested"
  | "support_contacted"
  | "data_exported"
  | "year_review_shared"
  | "referral_shared"
  | "referral_claimed"
  | "calendar_event_added"
  | "first_steps_action"
  | "first_steps_dismissed"
  | "notification_permission_result"
  | "competition_detailed"
  // Séance en direct (chrono, GPS) et sécurité en balade
  | "ride_started"
  | "ride_saved"
  | "ride_discarded"
  | "ride_safety_started"
  | "ride_safety_check"
  | "ride_safety_alert_sent"
  // Rappels
  | "notification_opened"
  | "session_reminder_action"
  // Usage (rétention : J1/J7/J30 se calculent sur app_opened dans PostHog)
  | "app_opened"
  | "session_created"
  | "session_completed";

type Props = Record<string, string | number | boolean | null | undefined>;

type QueuedEvent = { event: string; distinct_id: string; timestamp: string; properties: Props };

let queue: QueuedEvent[] = [];
let distinctId: string | null = null;
let anonId: string | null = null;
let started = false;
let flushing = false;

function enabled(): boolean {
  return !!API_KEY;
}

async function getAnonId(): Promise<string> {
  if (anonId) return anonId;
  try {
    const stored = await SecureStore.getItemAsync(ANON_ID_KEY);
    if (stored) {
      anonId = stored;
      return stored;
    }
    const fresh = Crypto.randomUUID();
    await SecureStore.setItemAsync(ANON_ID_KEY, fresh);
    anonId = fresh;
    return fresh;
  } catch {
    // Keychain indisponible : identifiant de session, perdu au prochain lancement.
    anonId = anonId ?? Crypto.randomUUID();
    return anonId;
  }
}

const baseProps: Props = {
  $lib: "horsetrack-mobile",
  platform: Platform.OS,
  app_version: Constants.expoConfig?.version ?? null,
};

/** Enregistre un événement. Synchrone côté appelant (fire-and-forget). */
export function track(event: AnalyticsEvent, props: Props = {}): void {
  if (!enabled()) {
    if (__DEV__) console.log(`[analytics] ${event}`, props);
    return;
  }
  const timestamp = new Date().toISOString();
  void (async () => {
    try {
      const id = distinctId ?? (await getAnonId());
      queue.push({ event, distinct_id: id, timestamp, properties: { ...baseProps, ...props } });
      if (queue.length >= FLUSH_AT) void flush();
    } catch {
      // best-effort
    }
  })();
}

/** Envoie la file. Les événements d'un envoi raté sont remis en file (une
 * seule fois — pas de croissance infinie hors ligne). */
export async function flush(): Promise<void> {
  if (!enabled() || flushing || queue.length === 0) return;
  flushing = true;
  const batch = queue;
  queue = [];
  try {
    const res = await fetch(`${HOST}/batch/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: API_KEY, batch }),
    });
    if (!res.ok && res.status >= 500) queue = [...batch, ...queue].slice(-200);
  } catch {
    queue = [...batch, ...queue].slice(-200);
  } finally {
    flushing = false;
  }
}

/** Rattache les événements au compte Supabase (même identifiant que
 * l'app_user_id RevenueCat, donc que les événements serveur du webhook). */
async function identify(userId: string): Promise<void> {
  if (distinctId === userId) return;
  const anon = await getAnonId();
  distinctId = userId;
  if (!enabled()) return;
  queue.push({
    event: "$identify",
    distinct_id: userId,
    timestamp: new Date().toISOString(),
    properties: { ...baseProps, $anon_distinct_id: anon },
  });
}

/** Déconnexion : les événements suivants repartent sur un nouvel anonyme. */
async function reset(): Promise<void> {
  await flush();
  distinctId = null;
  anonId = null;
  try {
    await SecureStore.deleteItemAsync(ANON_ID_KEY);
  } catch {
    // best-effort
  }
}

/** À appeler une fois au démarrage (cf. app/_layout.tsx). */
export function startAnalytics(): void {
  if (started) return;
  started = true;
  supabase.auth
    .getSession()
    .then(({ data }) => (data.session?.user ? identify(data.session.user.id) : undefined))
    .catch(() => {});
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user) void identify(session.user.id).catch(() => {});
    else if (event === "SIGNED_OUT") void reset();
  });
  // Ouverture de l'app (lancement, puis chaque retour au premier plan) : la
  // base des courbes de rétention. Sans clé PostHog, track() ne fait rien.
  track("app_opened", { cold: true });
  if (!enabled()) return;
  setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  AppState.addEventListener("change", (state) => {
    if (state === "active") track("app_opened", { cold: false });
    else void flush();
  });
}
