/**
 * Quand demander un avis App Store / Play Store — logique pure, testable
 * (l'appel natif vit dans ./reviewPrompt.ts).
 *
 * Principes (cf. recommandations Apple sur SKStoreReviewController) :
 * - jamais au premier usage : au moins 7 jours depuis la première ouverture ;
 * - juste après un moment positif (séance faite, export réussi, bilan
 *   partagé…), et seulement après en avoir cumulé plusieurs ;
 * - rarement : 120 jours entre deux demandes, 3 par an au plus (plafond
 *   d'Apple de toute façon) ;
 * - pas de question filtrante avant (« Tu aimes l'app ? ») : Apple l'interdit.
 */

export type ReviewPromptState = {
  firstSeenAt: string;
  positiveSinceLastRequest: number;
  requestedAt: string[];
};

export const REVIEW_MIN_DAYS_SINCE_FIRST_SEEN = 7;
export const REVIEW_MIN_POSITIVE_MOMENTS = 3;
export const REVIEW_MIN_DAYS_BETWEEN = 120;
export const REVIEW_MAX_PER_YEAR = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export function initialReviewState(now: Date): ReviewPromptState {
  return { firstSeenAt: now.toISOString(), positiveSinceLastRequest: 0, requestedAt: [] };
}

export function shouldRequestReview(state: ReviewPromptState, now: Date): boolean {
  if (now.getTime() - new Date(state.firstSeenAt).getTime() < REVIEW_MIN_DAYS_SINCE_FIRST_SEEN * DAY_MS) return false;
  if (state.positiveSinceLastRequest < REVIEW_MIN_POSITIVE_MOMENTS) return false;
  const times = state.requestedAt.map((t) => new Date(t).getTime());
  const last = times.length ? Math.max(...times) : null;
  if (last !== null && now.getTime() - last < REVIEW_MIN_DAYS_BETWEEN * DAY_MS) return false;
  const lastYear = times.filter((t) => now.getTime() - t < 365 * DAY_MS).length;
  return lastYear < REVIEW_MAX_PER_YEAR;
}

/** Enregistre un moment positif ; renvoie le nouvel état et s'il faut
 * demander un avis maintenant (l'état tient déjà compte de la demande). */
export function registerPositiveMoment(state: ReviewPromptState, now: Date): { state: ReviewPromptState; ask: boolean } {
  const next = { ...state, positiveSinceLastRequest: state.positiveSinceLastRequest + 1 };
  if (!shouldRequestReview(next, now)) return { state: next, ask: false };
  return {
    state: { ...next, positiveSinceLastRequest: 0, requestedAt: [...next.requestedAt, now.toISOString()].slice(-5) },
    ask: true,
  };
}
