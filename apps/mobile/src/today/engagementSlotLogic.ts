/**
 * Cartes d'engagement de l'Accueil (relances et suggestions qui ne sont pas
 * le quotidien du cheval). Jusqu'à cinq pouvaient s'empiler sous
 * « Aujourd'hui » ; une seule s'affiche désormais, la première de cette
 * liste qui a quelque chose à dire. Les autres attendent leur tour, sans
 * rien perdre : leurs plafonds et silences (cf. CLAUDE.md § Relances) ne
 * changent pas, et une carte non affichée n'est pas comptée comme vue.
 *
 * Ordre :
 * 1. Offre de retour — limitée dans le temps, décidée par le serveur.
 * 2. Premiers pas — le premier succès d'un nouveau compte passe avant tout.
 * 3. Bilan du mois — de la valeur, quelques jours en début de mois.
 * 4. Carte rappels — offre Premium liée à l'usage (soins notés).
 * 5. Parrainage — le moins urgent.
 */
export type EngagementCardId = "winback" | "first_steps" | "monthly_recap" | "reminders_upsell" | "referral";

export const ENGAGEMENT_PRIORITY: readonly EngagementCardId[] = [
  "winback",
  "first_steps",
  "monthly_recap",
  "reminders_upsell",
  "referral",
];

/** La carte à afficher parmi celles qui le demandent, ou aucune. */
export function pickEngagementCard(candidates: Iterable<EngagementCardId>): EngagementCardId | null {
  const wanted = new Set(candidates);
  return ENGAGEMENT_PRIORITY.find((id) => wanted.has(id)) ?? null;
}
