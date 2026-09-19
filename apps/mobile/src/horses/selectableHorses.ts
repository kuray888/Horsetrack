/**
 * Quels chevaux peut-on viser depuis un formulaire de création (rendez-vous,
 * dépense…) ou une vue « tous les chevaux » ?
 *
 * Deux exclusions, pour deux raisons différentes :
 *
 * 1. Les chevaux VERROUILLÉS par le palier gratuit — même règle exactement
 *    que HorseSwitcher (cf. son `locked`) : un cheval possédé au-delà de la
 *    limite du palier n'est pas utilisable, le proposer dans une case à
 *    cocher créerait des entrées que l'utilisateur ne pourrait plus jamais
 *    consulter. Le rang parmi les chevaux POSSÉDÉS fait foi, les partagés ne
 *    comptent jamais dans le quota (cf. profile.tsx, même règle).
 *
 * 2. Les chevaux PARTAGÉS (demi-pension, coach) — décision produit du
 *    2026-09-19 : on n'écrit jamais en masse sur le cheval de quelqu'un
 *    d'autre, même quand la RLS l'autoriserait (elle l'autorise pour
 *    rendez-vous/séances/journal/dépenses/pesées via can_access_horse, cf.
 *    rls.sql). Ça garde aussi le périmètre trivialement sûr : tout ce qui
 *    sort d'ici est un cheval dont on est propriétaire.
 *
 * Module volontairement pur et sans dépendance (même précaution que
 * planning/planningDestination.ts) : testable sans passer par l'import de
 * react-native, que Vitest ne sait pas parser. D'où le type structurel
 * générique plutôt qu'un import de `Horse`.
 */
/** Ce dont la RÈGLE de filtrage a besoin (cf. selectableHorses). */
export type FilterableHorse = { id: string; sharedRole: string | null };

/** Ce dont le reste du module a besoin : une fois le filtrage fait, seul
 * l'identifiant compte. Volontairement plus faible que FilterableHorse pour
 * que les composants d'UI puissent passer leur propre forme ({ id, name })
 * sans traîner le champ `sharedRole` jusque dans leurs props. */
export type ChosenHorse = { id: string };

export function selectableHorses<T extends FilterableHorse>(horses: T[], horseLimit: number): T[] {
  const ownedIds = horses.filter((h) => !h.sharedRole).map((h) => h.id);
  return horses.filter((h) => !h.sharedRole && ownedIds.indexOf(h.id) < horseLimit);
}

/** Le sélecteur multi-chevaux ne s'affiche qu'à partir de deux chevaux
 * utilisables : avec un seul, il n'y a aucun choix à faire et la case à
 * cocher unique n'apporterait que du bruit (même principe que HorseSwitcher,
 * masqué en dessous de 2 chevaux). En pratique, un compte gratuit
 * (FREE_HORSE_LIMIT = 1) n'atteint jamais ce seuil : la fonctionnalité se
 * gate donc d'elle-même, sans <Locked> supplémentaire. */
export function shouldOfferHorseChoice(selectable: ChosenHorse[]): boolean {
  return selectable.length >= 2;
}

/** Chevaux effectivement visés par une soumission de formulaire : le choix
 * explicite de l'utilisateur s'il en a fait un, sinon le cheval actif seul.
 * Un tableau vide signifie « aucun choix explicite » et non « aucun cheval »,
 * ce qui permet à tous les écrans qui n'affichent pas le sélecteur de garder
 * exactement le comportement d'avant sans rien changer chez eux.
 *
 * Filtre toujours sur `selectable` : une case cochée puis devenue
 * inutilisable (fin d'essai Premium, cheval supprimé depuis un autre
 * appareil) ne doit pas créer une entrée fantôme. */
export function resolveTargetHorseIds(
  explicitIds: string[],
  selectable: ChosenHorse[],
  activeHorseId: string | null
): string[] {
  const allowed = explicitIds.filter((id) => selectable.some((h) => h.id === id));
  if (allowed.length > 0) return allowed;
  return activeHorseId ? [activeHorseId] : [];
}

/** Applique un clic sur la puce d'un cheval. Refuse de tout décocher : un
 * formulaire sans aucun cheval ne pourrait rien créer, et laisser
 * l'utilisateur y arriver pour lui refuser ensuite la soumission serait une
 * impasse. `current` vide valant « cheval actif », on matérialise d'abord ce
 * choix implicite avant de le modifier. */
export function toggleHorseId(
  current: string[],
  horseId: string,
  activeHorseId: string | null
): string[] {
  const base = current.length > 0 ? current : activeHorseId ? [activeHorseId] : [];
  if (!base.includes(horseId)) return [...base, horseId];
  if (base.length === 1) return base;
  return base.filter((id) => id !== horseId);
}
