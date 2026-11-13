/**
 * Carte « Parraine un ami » sur l'Accueil (tableau des relances de CLAUDE.md) :
 * le parrainage existe (un mois de Premium au parrain quand son ami s'abonne)
 * mais restait caché dans le Profil. Proposé après des moments positifs, avec
 * des plafonds stricts. Logique pure, testée dans referralNudgeLogic.test.ts.
 */
export type ReferralNudgeState = {
  firstSeenAt: string;
  positive: number;
  /** Fermetures (×) et ouvertures du parrainage depuis la carte. */
  closedAt: string[];
  dismissals: number;
};

export const REFERRAL_MIN_DAYS = 10;
export const REFERRAL_MIN_POSITIVE = 5;
export const REFERRAL_SILENCE_DAYS = 30;
export const REFERRAL_MAX_PER_YEAR = 4;
export const REFERRAL_MAX_DISMISSALS = 2;
const DAY = 86_400_000;

export function initialReferralNudge(now: Date): ReferralNudgeState {
  return { firstSeenAt: now.toISOString(), positive: 0, closedAt: [], dismissals: 0 };
}

export function countPositive(state: ReferralNudgeState): ReferralNudgeState {
  return { ...state, positive: state.positive + 1 };
}

export function shouldShowReferralNudge(state: ReferralNudgeState, now: Date): boolean {
  const t = now.getTime();
  if (t - Date.parse(state.firstSeenAt) < REFERRAL_MIN_DAYS * DAY) return false;
  if (state.positive < REFERRAL_MIN_POSITIVE || state.dismissals >= REFERRAL_MAX_DISMISSALS) return false;
  const closes = state.closedAt.map((d) => Date.parse(d));
  if (closes.some((c) => t - c < REFERRAL_SILENCE_DAYS * DAY)) return false;
  return closes.filter((c) => t - c < 365 * DAY).length < REFERRAL_MAX_PER_YEAR;
}

export function closeReferralNudge(state: ReferralNudgeState, now: Date, how: "dismissed" | "opened"): ReferralNudgeState {
  return {
    ...state,
    closedAt: [...state.closedAt, now.toISOString()].slice(-8),
    dismissals: state.dismissals + (how === "dismissed" ? 1 : 0),
  };
}
