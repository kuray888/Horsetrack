/**
 * Langue des réponses gardées en cache par le coach.
 *
 * L'idée de séance (une par compte, cheval et jour) et le résumé du mois sont
 * gardés en base et relus tels quels. Sans tenir compte de la langue, une app
 * passée en anglais affichait le texte français déjà en cache — et inversement
 * (cf. audit du 2026-11-11). Un résultat sans langue enregistrée (écrit avant
 * ce correctif) est servi tel quel : on ne sait pas, on ne régénère pas.
 */
export type CoachLang = "fr" | "en";

export function cachedSuggestionUsable(result: unknown, lang: CoachLang): boolean {
  const stored = (result as { lang?: unknown } | null)?.lang;
  return stored === undefined || stored === lang;
}

/** Un résumé terminé dans une autre langue que celle de l'app se refait (il
 * compte déjà dans le quota du mois : la ligne existe). */
export function summaryNeedsTranslation(existing: { status: string; lang: string }, lang: CoachLang): boolean {
  return existing.status === "DONE" && existing.lang !== lang;
}
