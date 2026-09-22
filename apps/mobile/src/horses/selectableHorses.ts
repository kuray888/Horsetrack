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

/** Le sélecteur multi-chevaux ne s'affiche que si le choix a un sens :
 *
 * 1. Au moins DEUX chevaux utilisables — avec un seul, il n'y a aucun choix à
 *    faire et la case unique n'apporterait que du bruit (même principe que
 *    HorseSwitcher). En pratique un compte gratuit (FREE_HORSE_LIMIT = 1)
 *    n'atteint jamais ce seuil : la fonctionnalité se gate d'elle-même, sans
 *    <Locked> supplémentaire.
 * 2. Une cible par défaut (`fallbackIds`) entièrement composée de chevaux
 *    proposables. Quand l'écran est cadré sur un cheval PARTAGÉ (absent de
 *    `selectable`, jamais écrit en masse — cf. plus haut), le sélecteur
 *    afficherait des puces toutes décochées alors que la création part sur ce
 *    cheval partagé : incohérent, donc masqué et comportement d'origine. */
export function shouldOfferHorseChoice(selectable: ChosenHorse[], fallbackIds: string[]): boolean {
  return selectable.length >= 2 && fallbackIds.every((id) => selectable.some((h) => h.id === id));
}

/** Plafond d'entrées créées par UNE soumission de rendez-vous (chevaux ×
 * occurrences de récurrence). Égal au maximum d'occurrences qu'un seul cheval
 * pouvait déjà produire (cf. lib/recurrence.ts) : chaque entrée programme une
 * notification locale ET un e-mail de rappel, et iOS ne conserve que les 64
 * notifications locales les plus proches. Multiplier sans borne par le nombre
 * de chevaux enverrait des rappels dans le vide, en silence. */
export const MAX_ENTRIES_PER_SUBMIT = 52;

/** Chevaux effectivement visés par une soumission de formulaire : le choix
 * explicite de l'utilisateur s'il en a fait un, sinon `fallbackIds`.
 *
 * `fallbackIds` est la cible PAR DÉFAUT de l'écran appelant, et c'est lui qui
 * porte la différence entre les deux vues du Planning : le cheval ciblé quand
 * une puce de cheval est posée, AUCUNE cible par défaut (tableau vide) quand
 * la puce « Tous » l'est. Écrire d'un coup sur toute l'écurie reste possible,
 * mais se coche : une vue qui mêle plusieurs chevaux ne dit pas lequel on
 * vise, et prendre « Tous » pour une cible créait en un appui autant
 * d'entrées que de chevaux — irréversible en bloc, chaque entrée devant
 * ensuite être supprimée une par une. Le formulaire exige donc une sélection
 * (cf. `needsExplicitHorseChoice`, qui bloque la soumission).
 *
 * `fallbackIds` n'est volontairement PAS filtré sur `selectable` : le cheval
 * actif peut être un cheval partagé, absent de la liste proposable, et doit
 * garder le comportement d'origine.
 *
 * Un tableau `explicitIds` vide signifie « aucun choix explicite » et non
 * « aucun cheval », ce qui permet à tous les écrans qui n'affichent pas le
 * sélecteur de garder exactement le comportement d'avant.
 *
 * Le choix explicite, lui, est toujours filtré sur `selectable` : une case
 * cochée puis devenue inutilisable (fin d'essai Premium, cheval supprimé
 * depuis un autre appareil) ne doit pas créer une entrée fantôme. */
export function resolveTargetHorseIds(
  explicitIds: string[],
  selectable: ChosenHorse[],
  fallbackIds: string[]
): string[] {
  const allowed = explicitIds.filter((id) => selectable.some((h) => h.id === id));
  return allowed.length > 0 ? allowed : fallbackIds;
}

/** La soumission doit-elle être refusée faute de cheval visé ? Vrai
 * uniquement quand le sélecteur est proposé ET que rien n'est coché — c'est
 * le cas de la vue « Tous » du Planning, dont la cible par défaut est vide
 * depuis qu'une création y exige un choix explicite (cf.
 * resolveTargetHorseIds). Partout ailleurs `fallbackIds` porte au moins un
 * cheval, donc faux : les écrans cadrés sur un cheval ne changent pas.
 *
 * Une seule fonction pour les deux usages, sinon le bouton et la soumission
 * dériveraient : le formulaire désactive son bouton dessus, et la soumission
 * s'en sert de ceinture (cf. useAppointmentForm/useExpenseForm/planning.tsx). */
export function needsExplicitHorseChoice(
  explicitIds: string[],
  selectable: ChosenHorse[],
  fallbackIds: string[]
): boolean {
  return (
    shouldOfferHorseChoice(selectable, fallbackIds) &&
    resolveTargetHorseIds(explicitIds, selectable, fallbackIds).length === 0
  );
}

/** Applique un clic sur la puce d'un cheval. Refuse de tout décocher : un
 * formulaire sans aucun cheval ne pourrait rien créer, et laisser
 * l'utilisateur y arriver pour lui refuser ensuite la soumission serait une
 * impasse. `current` vide valant « cible par défaut », on matérialise d'abord
 * ce choix implicite avant de le modifier — décocher un cheval depuis « Tous »
 * donne donc bien « tous sauf celui-là ». */
export function toggleHorseId(current: string[], horseId: string, fallbackIds: string[]): string[] {
  const base = current.length > 0 ? current : fallbackIds;
  if (!base.includes(horseId)) return [...base, horseId];
  if (base.length === 1) return base;
  return base.filter((id) => id !== horseId);
}

/** Chevaux visés qui n'apparaîtront PAS dans la vue de l'écran qui les crée —
 * `visibleIds` étant ce que la liste affiche (le cheval actif dans Agenda, tous
 * les proposables ou le cheval filtré dans Planning). Distinct de
 * `fallbackIds`, qui est vide en vue « Tous » alors que cette vue affiche
 * justement tout : les confondre ferait annoncer « créé pour un cheval absent
 * de cette vue » pour une entrée parfaitement visible. Sert à prévenir l'utilisateur : une
 * entrée créée pour un autre cheval que celui affiché disparaît sinon
 * silencieusement, comme si l'enregistrement avait échoué. */
export function targetsOutsideView(targetIds: string[], visibleIds: string[]): string[] {
  return targetIds.filter((id) => !visibleIds.includes(id));
}

/** Message de confirmation pour les chevaux de `targetsOutsideView`. */
export function hiddenTargetsMessage(names: string[]): string {
  if (names.length === 0) return "";
  const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
  return names.length === 1
    ? `Créé pour ${who}, qui n'apparaît pas dans cette vue. Change de cheval actif (ou choisis « Tous » dans Planning) pour le retrouver.`
    : `Créé pour ${who}, qui n'apparaissent pas dans cette vue. Change de cheval actif (ou choisis « Tous » dans Planning) pour les retrouver.`;
}
