import { randomInt } from "node:crypto";

/**
 * Parrainage — règles pures, testées (referrals.test.ts).
 *
 * - Chaque cavalier a un code (6 caractères lisibles, sans 0/O ni 1/I).
 * - Un nouveau compte (30 jours au plus) peut saisir le code d'un ami, une
 *   seule fois, jamais le sien, et seulement s'il n'a jamais été abonné.
 * - Quand ce filleul PAIE pour la première fois (achat hors essai, ou
 *   renouvellement), le parrain reçoit 1 mois de Premium offert, via
 *   RevenueCat (octroi promotionnel, aucun paiement). Créer de faux comptes
 *   ne rapporte donc rien.
 * - 12 mois offerts par an au plus par parrain.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
export const CLAIM_WINDOW_DAYS = 30;
export const MAX_REWARDS_PER_YEAR = 12;
export const REWARD_DAYS = 30;

export function generateReferralCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export function normalizeReferralCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, "");
}

export function isReferralCodeFormat(code: string): boolean {
  return new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`).test(code);
}

export type ClaimRefusal = "own_code" | "too_old" | "already_referred" | "already_subscriber";

export function claimRefusal(input: {
  refereeUserId: string;
  referrerUserId: string;
  refereeCreatedAt: Date;
  alreadyReferred: boolean;
  everSubscribed: boolean;
  now: Date;
}): ClaimRefusal | null {
  if (input.refereeUserId === input.referrerUserId) return "own_code";
  if (input.alreadyReferred) return "already_referred";
  if (input.everSubscribed) return "already_subscriber";
  const ageDays = (input.now.getTime() - input.refereeCreatedAt.getTime()) / 86_400_000;
  if (ageDays > CLAIM_WINDOW_DAYS) return "too_old";
  return null;
}

/** L'événement RevenueCat est-il un vrai paiement du filleul ? */
export function isPaidConversionEvent(event: { type?: string; period_type?: string; store?: string }): boolean {
  if (event.store?.toUpperCase() === "PROMOTIONAL") return false;
  if (event.type === "RENEWAL") return true;
  if (event.type === "INITIAL_PURCHASE") return (event.period_type ?? "NORMAL").toUpperCase() !== "TRIAL";
  return false;
}

/** Fin du mois offert : à la suite de l'accès en cours s'il y en a un (le
 * parrain déjà abonné le garde après son abonnement), sinon dès maintenant. */
export function rewardEndTime(currentExpiry: Date | null, now: Date): Date {
  const start = currentExpiry && currentExpiry > now ? currentExpiry : now;
  return new Date(start.getTime() + REWARD_DAYS * 86_400_000);
}
