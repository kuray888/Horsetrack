/**
 * Palier gratuit resserré (décision du 2026-11-16, 1.3.0) — logique pure.
 *
 * Ne vise QUE les comptes créés à partir de `FREE_TIER_V2_SINCE` : un compte
 * plus ancien garde exactement le gratuit qu'il a connu (règle de
 * rétrocompatibilité, cf. CLAUDE.md). Premium (actif, essai, offert) n'est
 * jamais concerné.
 *
 * - Historique : les 90 derniers jours restent affichés ; le reste est gardé
 *   (appareil et serveur) et réapparaît avec Premium. Limite d'AFFICHAGE
 *   seulement : masquer ces lignes côté serveur les ferait supprimer des
 *   appareils par la synchro (cf. lib/cloudSync.ts, lignes disparues).
 * - Objectifs : 1 à la fois (aussi appliqué côté serveur, trigger
 *   `goals_free_limit` de rls.sql, section objectifs-gratuits).
 * - « Mon année » : Premium.
 */

/** Doit rester identique à la date de `rider_free_tier_restricted`
 * (packages/db/prisma/rls.sql, section objectifs-gratuits). Choisie après la
 * sortie prévue de la 1.3.0 : un compte créé avant n'est jamais restreint. */
export const FREE_TIER_V2_SINCE = new Date("2026-11-20T00:00:00Z");
export const FREE_HISTORY_DAYS = 90;
export const FREE_GOALS = 1;

/** Vrai si ce compte est soumis au gratuit resserré. Date de création
 * inconnue (hors ligne, pas encore lue) → jamais restreint. */
export function isFreeTierRestricted(premium: boolean, accountCreatedAt: Date | null): boolean {
  if (premium || !accountCreatedAt) return false;
  const ms = accountCreatedAt.getTime();
  if (Number.isNaN(ms)) return false;
  return ms >= FREE_TIER_V2_SINCE.getTime();
}

/** Premier jour encore affiché (minuit local), ou null sans limite. */
export function historyCutoff(restricted: boolean, now: Date = new Date()): Date | null {
  if (!restricted) return null;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - FREE_HISTORY_DAYS);
}

/** Sépare ce qui reste affiché de ce qui est masqué (sans rien supprimer). */
export function splitHistory<T>(
  items: readonly T[],
  dateOf: (item: T) => Date,
  cutoff: Date | null
): { visible: T[]; hiddenCount: number } {
  if (!cutoff) return { visible: [...items], hiddenCount: 0 };
  const limit = cutoff.getTime();
  const visible = items.filter((item) => dateOf(item).getTime() >= limit);
  return { visible, hiddenCount: items.length - visible.length };
}

/** Un nouvel objectif peut-il être créé ? Les objectifs déjà là restent
 * (créés pendant un essai, par exemple) : seul l'ajout est limité. */
export function canAddGoal(restricted: boolean, goalCount: number): boolean {
  return !restricted || goalCount < FREE_GOALS;
}
