import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { withKeyLock } from "@/lib/keyLock";
import { safeJsonParse } from "@/lib/safeJsonParse";
import { cancelReminder, getNotificationStatus, scheduleReminder } from "@/lib/notifications";
import { cancelEmailReminder, scheduleEmailReminder } from "@/lib/emailReminders";
import { getSubscriptionPackage } from "@/lib/revenuecat";
import { track } from "@/lib/analytics";
import { computeIsActiveOrTrialing, type Persisted } from "./logic";
import { FALLBACK_PRICE, formatDayMonth, trialReminderDate } from "./paywallLogic";

/**
 * Tient la promesse du paywall (« on te prévient avant la fin de l'essai ») et
 * accompagne l'essai :
 * - rappel de fin d'essai 3 jours avant (la veille si l'essai est plus court),
 *   par notification si elle est autorisée, sinon par email (cf.
 *   /api/email-reminders, ouvert aux comptes en essai) ;
 * - relance d'activation à J+3 tant qu'aucune fonction Premium n'a servi
 *   (cf. markPremiumActivated), notification uniquement ;
 * - tout est annulé dès que le compte n'est plus en essai (achat confirmé,
 *   expiration, déconnexion, changement de compte).
 *
 * Idempotent : `syncTrialLifecycle` peut être appelé à chaque changement
 * d'état et à chaque retour au premier plan. Un email refusé par le serveur
 * (webhook RevenueCat pas encore arrivé) est retenté à l'appel suivant.
 */

const KEY = "trial_lifecycle_v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_EMAIL_ATTEMPTS = 5;

type Stored = {
  trialEndsAt: string;
  /** Première fois que cet essai a été vu sur cet appareil ≈ début d'essai. */
  firstSeenAt: string;
  endPushId: string | null;
  emailId: string | null;
  /** Tentatives d'email refusées (webhook pas encore arrivé, essai résilié
   * côté serveur…) : plafonnées pour ne pas rappeler l'API à chaque retour
   * au premier plan pendant tout l'essai. */
  emailAttempts?: number;
  nudgeId: string | null;
  activated: boolean;
};

const CANCEL_WHERE = Platform.OS === "ios" ? "Réglages > Abonnements" : "Google Play > Abonnements";

async function read(): Promise<Stored | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  return raw ? safeJsonParse<Stored | null>(raw, null) : null;
}

async function write(s: Stored | null): Promise<void> {
  if (s) await SecureStore.setItemAsync(KEY, JSON.stringify(s));
  else await SecureStore.deleteItemAsync(KEY);
}

async function cancelAll(s: Stored): Promise<void> {
  await Promise.all([cancelReminder(s.endPushId), cancelReminder(s.nudgeId), cancelEmailReminder(s.emailId)]);
}

async function endReminderText(state: Persisted, end: Date): Promise<{ title: string; body: string }> {
  const day = formatDayMonth(end);
  // Essai par code promo (cf. store.redeemPromoCode) : aucun abonnement
  // store derrière, donc aucun prélèvement à annoncer.
  if (state.billingPeriod === null) {
    return {
      title: `Ton essai Premium offert se termine le ${day}`,
      body: "Pour garder tous tes chevaux, rappels et documents, passe à Premium depuis ton profil. Sinon, tu repasses en version gratuite et tes données restent conservées.",
    };
  }
  const period = state.billingPeriod;
  const pkg = await getSubscriptionPackage(period).catch(() => null);
  const price = pkg?.product.priceString ?? FALLBACK_PRICE[period].priceString;
  return {
    title: `Ton essai Premium se termine le ${day}`,
    body: `Sans action de ta part, l'abonnement démarre ce jour-là (${price} par ${period === "ANNUAL" ? "an" : "mois"}). Pour l'arrêter : ${CANCEL_WHERE}. Si tu l'as déjà résilié, rien ne sera prélevé.`,
  };
}

/** J+3 à 18h, s'il n'est pas déjà passé. */
function nudgeDate(firstSeenAt: Date, now: Date): Date | null {
  const at = new Date(firstSeenAt.getTime() + 3 * DAY_MS);
  at.setHours(18, 0, 0, 0);
  return at.getTime() > now.getTime() ? at : null;
}

async function scheduleMissing(state: Persisted, s: Stored): Promise<Stored> {
  const now = new Date();
  const end = new Date(s.trialEndsAt);
  const remindAt = trialReminderDate(end, now);
  const pushAllowed = await getNotificationStatus().catch(() => false);
  const next = { ...s };

  if (remindAt && !next.endPushId) {
    const { title, body } = await endReminderText(state, end);
    if (pushAllowed) {
      next.endPushId = await scheduleReminder(title, body, remindAt).catch(() => null);
      if (next.endPushId) {
        // La notification remplace l'email de repli éventuellement programmé
        // avant l'autorisation (cf. écran de bienvenue Premium).
        await cancelEmailReminder(next.emailId);
        next.emailId = null;
        track("trial_reminder_scheduled", { channel: "push", promo: state.billingPeriod === null });
      }
    } else if (!next.emailId && (next.emailAttempts ?? 0) < MAX_EMAIL_ATTEMPTS) {
      next.emailAttempts = (next.emailAttempts ?? 0) + 1;
      next.emailId = await scheduleEmailReminder(remindAt, title, body);
      if (next.emailId) track("trial_reminder_scheduled", { channel: "email", promo: state.billingPeriod === null });
    }
  }

  if (!next.activated && !next.nudgeId && pushAllowed) {
    const at = nudgeDate(new Date(next.firstSeenAt), now);
    if (at) {
      next.nudgeId = await scheduleReminder(
        "Premium : ton premier rappel santé",
        "Ajoute un rappel à ton prochain rendez-vous véto ou maréchal : HorseTrack te préviendra à temps.",
        at
      ).catch(() => null);
    }
  }
  return next;
}

export async function syncTrialLifecycle(state: Persisted): Promise<void> {
  try {
    await withKeyLock(KEY, async () => {
      const stored = await read();
      const trialing = state.status === "trialing" && !!state.trialEndsAt && computeIsActiveOrTrialing(state);

      if (!trialing) {
        if (stored) {
          await cancelAll(stored);
          await write(null);
        }
        return;
      }

      let current = stored;
      if (!current || current.trialEndsAt !== state.trialEndsAt) {
        if (current) await cancelAll(current);
        current = {
          trialEndsAt: state.trialEndsAt!,
          firstSeenAt: new Date().toISOString(),
          endPushId: null,
          emailId: null,
          nudgeId: null,
          activated: current?.activated ?? false,
        };
      }
      await write(await scheduleMissing(state, current));
    });
  } catch (e) {
    console.warn("[trialLifecycle] synchronisation échouée", e);
  }
}

/** Une fonction Premium a servi (rappel, document, 2ᵉ cheval, partage) : la
 * relance d'activation n'a plus lieu d'être. Best-effort, fire-and-forget. */
export function markPremiumActivated(): void {
  withKeyLock(KEY, async () => {
    const stored = await read();
    if (!stored || stored.activated) return;
    await cancelReminder(stored.nudgeId);
    await write({ ...stored, activated: true, nudgeId: null });
  }).catch(() => {});
}
