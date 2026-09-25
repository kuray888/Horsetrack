/**
 * Répartition d'un montant entre plusieurs chevaux — une facture unique
 * (maréchal, vétérinaire venu pour toute l'écurie) donne N dépenses dont la
 * somme doit retomber EXACTEMENT sur le montant facturé.
 *
 * Le calcul se fait en centimes, jamais en euros flottants : 100 / 3 en
 * nombres à virgule flottante donne 33.333333333333336, et trois dépenses
 * arrondies à 33,33 € ne feraient plus que 99,99 €. On divise donc les
 * centimes entiers, et on distribue le reste (au plus N-1 centimes) un par
 * un aux premiers chevaux de la liste. Le total est alors exact par
 * construction, et la règle reste déterministe : deux répartitions du même
 * montant sur la même liste donnent toujours le même résultat.
 *
 * Module pur et sans dépendance, comme planning/planningDestination.ts.
 */
export function splitAmount(amount: number, parts: number): number[] {
  if (parts <= 0) return [];
  if (parts === 1) return [amount];
  const totalCents = Math.round(amount * 100);
  const baseCents = Math.floor(totalCents / parts);
  const remainderCents = totalCents - baseCents * parts;
  return Array.from({ length: parts }, (_, i) => (baseCents + (i < remainderCents ? 1 : 0)) / 100);
}

/** Les deux façons de comprendre un montant saisi pour plusieurs chevaux.
 * `per-horse` : le montant vaut POUR CHACUN (trois pensions de 300 €).
 * `split` : le montant est une facture globale À RÉPARTIR (un déplacement de
 * maréchal de 180 € pour trois chevaux). Aucune des deux n'est un défaut
 * évident — d'où un choix explicite dans le formulaire plutôt qu'une règle
 * implicite que l'utilisateur découvrirait après coup (décision produit du
 * 2026-09-19). */
export type AmountMode = "per-horse" | "split";

/** Montants à créer, un par cheval visé, selon le mode choisi. */
export function amountsForHorses(amount: number, horseCount: number, mode: AmountMode): number[] {
  if (horseCount <= 0) return [];
  return mode === "split" ? splitAmount(amount, horseCount) : Array.from({ length: horseCount }, () => amount);
}
