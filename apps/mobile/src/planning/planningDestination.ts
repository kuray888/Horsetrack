/**
 * Aucune dépendance volontairement (cf. son test unifiedEvents.ts réexporte
 * ces déclarations, mais un import de ce module entraîne le chargement de
 * agenda/meta.ts -> agenda/store.tsx, qui importe react-native directement ;
 * Vitest/Rolldown ne sait pas parser sa syntaxe Flow en environnement de
 * test). Séparé dans son propre fichier pur pour rester testable en
 * isolation sans ce chemin d'import.
 */
export type PlanningFilterValue = "all" | "session" | "soin" | "concours" | "autre";

/** Valeurs valides de PlanningFilterValue — utilisé par PlanningScreen pour
 * valider un `?filter=` de route (cf. app/horse/[id]/index.tsx, dont les
 * cartes Entraînement/Concours poussent ici avec ?filter=session|concours)
 * avant de s'en servir comme état initial. */
export const PLANNING_FILTER_VALUES: PlanningFilterValue[] = ["all", "session", "soin", "concours", "autre"];

/**
 * Vrai si `nextFilterParam` porte une NOUVELLE destination explicite valide
 * (différente de `prevFilterParam`) — ex: Horse Hub > Entraînement
 * (`?filter=session`) puis Horse Hub > Concours (`?filter=concours`).
 *
 * Planning reste monté entre deux visites (`router.dismissTo`, cf.
 * app/horse/[id]/index.tsx, ne le démonte pas) : un formulaire de création
 * laissé ouvert lors d'une visite précédente (Nouvelle séance, ou un Quick
 * Add rendez-vous/dépense/journal déclenché depuis Planning) restait
 * affiché par-dessus la liste nouvellement filtrée (cf. bug "Horse Hub >
 * Entraînement puis Concours affiche encore le formulaire Séance", audit du
 * 2026-09-05 round 4). PlanningScreen appelle cette fonction pour décider
 * quand fermer ces formulaires — la destination explicitement demandée doit
 * toujours primer sur un état résiduel.
 *
 * Un paramètre absent/invalide (navigation sans intention de filtre
 * explicite, ex: Quick Add "Séance" qui ne passe que `?openForm=session`)
 * ne doit jamais fermer un formulaire en cours de saisie par ailleurs.
 */
export function isNewPlanningDestination(
  prevFilterParam: string | undefined,
  nextFilterParam: string | undefined
): boolean {
  return nextFilterParam !== prevFilterParam && PLANNING_FILTER_VALUES.includes(nextFilterParam as PlanningFilterValue);
}
