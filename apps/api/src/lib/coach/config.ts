/**
 * Réglages du coach IA. Tout ce qui coûte ou qui protège est ici.
 *
 * Interrupteur : le coach ne répond que si COACH_ENABLED vaut « 1 » ET qu'une
 * clé ANTHROPIC_API_KEY est présente. Sinon l'app reçoit « indisponible » et
 * affiche la suggestion calculée par le code. Couper l'interrupteur sur
 * Vercel suffit à tout arrêter, sans redéployer l'app.
 */

export const COACH_MODEL = "claude-haiku-5-5";

/** Tarifs Claude Haiku 5.5, $ par million de tokens (relevés en octobre
 * 2026 ; prompts de moins de 100 000 tokens). Cache : lecture à 10 % du
 * prix d'entrée, écriture (5 min) à 125 %. Batch API : moitié prix. */
export const PRICES = {
  input: 0.1,
  output: 0.5,
  cacheRead: 0.01,
  cacheWrite: 0.125,
} as const;

/** Quotas par compte Premium (choix « prudent » du 2026-10-28). */
export const QUOTAS = {
  /** Une suggestion IA par cheval et par jour, relue ensuite. */
  suggestionHorsesPerDay: 3,
  questionsPerMonth: 30,
  summaryHorsesPerMonth: 3,
} as const;

/** Plafond de dépense mensuel côté serveur, en plus de celui du compte
 * Anthropic : au-delà, le coach se met en pause jusqu'au mois suivant. */
export function monthlyBudgetUsd(): number {
  const v = Number(process.env.COACH_MONTHLY_BUDGET_USD);
  return Number.isFinite(v) && v > 0 ? v : 10;
}

export function coachEnabled(): boolean {
  return process.env.COACH_ENABLED === "1" && !!process.env.ANTHROPIC_API_KEY;
}

/** Bornes de sortie : réponses courtes, coût prévisible. Les tokens de
 * réflexion (effort bas) comptent dans `max_tokens`. */
export const MAX_TOKENS = { suggestion: 1500, question: 1200, summary: 1200 } as const;
