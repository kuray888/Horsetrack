/** Règles du résumé mensuel du coach — logique pure, testée (summaryRules.test.ts). */

const HOUR_MS = 3_600_000;
/** Délai avant de relancer un résumé en échec : chaque essai coûte un appel au modèle. */
const RETRY_AFTER_MS = 24 * HOUR_MS;

/** Le mois « AAAA-MM » est-il terminé pour au moins un fuseau ? L'app envoie
 * le mois local du cavalier : on compare au mois en UTC+14 (le fuseau le plus
 * en avance), sinon le 1er à 0 h 30 en France (encore la veille en UTC) le
 * mois écoulé passait pour « en cours ». */
export function isFinishedMonth(month: string, now: Date = new Date()): boolean {
  return month < new Date(now.getTime() + 14 * HOUR_MS).toISOString().slice(0, 7);
}

/** Un résumé en échec se relance, au plus une fois par jour. */
export function canRetrySummary(row: { status: string; updatedAt: Date }, now: Date = new Date()): boolean {
  return row.status === "FAILED" && now.getTime() - row.updatedAt.getTime() > RETRY_AFTER_MS;
}
