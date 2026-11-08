/**
 * Relance Premium périodique — logique pure, testable (l'affichage vit dans
 * ./PremiumNudge.tsx), sur le modèle de lib/reviewPromptLogic.ts.
 *
 * Pour le cavalier gratuit qui utilise l'app sans jamais buter sur une
 * limite (les paywalls contextuels ne le voient donc jamais). Principes :
 * - jamais trop tôt : 3 jours d'usage ET de vraies traces d'usage (séances
 *   faites, souvenirs, rendez-vous) — on relance quelqu'un qui a déjà vu la
 *   valeur de l'app, pas un curieux du premier jour ;
 * - de plus en plus rare : 7 jours après la 1re relance, 14 après la 2e,
 *   puis une fois par mois au plus ;
 * - jamais par-dessus un autre paywall : 3 jours de silence après n'importe
 *   quel paywall vu (limite atteinte, carte d'incitation, onboarding) ;
 * - jamais pour un abonné, un essai en cours ou un Premium offert.
 */

export type NudgeState = {
  firstSeenAt: string;
  /** Dates des relances affichées (les 5 dernières). */
  shownAt: string[];
  /** Dernier paywall vu, quelle qu'en soit l'origine. */
  lastPaywallAt: string | null;
};

export const NUDGE_MIN_DAYS_SINCE_FIRST_SEEN = 3;
export const NUDGE_MIN_ACTIVITY = 3;
/** Délai minimal avant la relance n°(index + 2) : 7 j après la 1re, 14 après
 * la 2e, puis 30 pour toutes les suivantes. */
export const NUDGE_INTERVALS_DAYS = [7, 14, 30] as const;
export const NUDGE_QUIET_AFTER_PAYWALL_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export function initialNudgeState(now: Date): NudgeState {
  return { firstSeenAt: now.toISOString(), shownAt: [], lastPaywallAt: null };
}

function daysSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / DAY_MS;
}

export function shouldShowNudge(
  state: NudgeState,
  ctx: { premium: boolean; activityCount: number; now: Date }
): boolean {
  const { premium, activityCount, now } = ctx;
  if (premium) return false;
  if (activityCount < NUDGE_MIN_ACTIVITY) return false;
  if (daysSince(state.firstSeenAt, now) < NUDGE_MIN_DAYS_SINCE_FIRST_SEEN) return false;
  if (state.lastPaywallAt && daysSince(state.lastPaywallAt, now) < NUDGE_QUIET_AFTER_PAYWALL_DAYS) return false;
  // Nombre total de relances : `shownAt` ne garde que les 5 dernières, mais
  // au-delà de 3 l'intervalle est de toute façon le dernier (30 j).
  const count = state.shownAt.length;
  if (count === 0) return true;
  const last = state.shownAt[count - 1];
  const interval = NUDGE_INTERVALS_DAYS[Math.min(count - 1, NUDGE_INTERVALS_DAYS.length - 1)];
  return daysSince(last, now) >= interval;
}

/** La relance vient d'être affichée (elle compte aussi comme paywall vu). */
export function recordNudgeShown(state: NudgeState, now: Date): NudgeState {
  const iso = now.toISOString();
  return { ...state, shownAt: [...state.shownAt, iso].slice(-5), lastPaywallAt: iso };
}

/** Un paywall (n'importe lequel) vient d'être vu. */
export function recordPaywallSeen(state: NudgeState, now: Date): NudgeState {
  return { ...state, lastPaywallAt: now.toISOString() };
}
