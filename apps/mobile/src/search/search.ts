/**
 * Recherche transversale : séances, rendez-vous, journal, dépenses,
 * documents.
 *
 * À mesure que l'historique grandit, retrouver « le vaccin de l'an dernier »,
 * « la facture du maréchal d'août » ou « la séance où il était tendu »
 * devenait un parcours à l'aveugle dans cinq listes, chacune filtrée par un
 * cheval différent.
 *
 * Module pur, sans dépendance à react-native (même précaution que
 * horses/selectableHorses.ts) : la règle de correspondance et le classement
 * se testent sans rendu.
 */

export type SearchKind = "session" | "appointment" | "journal" | "expense" | "document";

export type SearchResult = {
  kind: SearchKind;
  id: string;
  /** Ce qui identifie l'entrée : titre du rendez-vous, activité, catégorie… */
  title: string;
  /** Contexte secondaire (notes, professionnel, montant). */
  subtitle: string;
  date: Date;
  horseId: string | null;
};

/** Normalise pour comparer : minuscules et sans accents. « vetérinaire »,
 * « Vétérinaire » et « veterinaire » doivent tous trouver la même chose —
 * personne ne tape les accents dans un champ de recherche. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** En dessous, la recherche renverrait la moitié de l'historique : on attend
 * d'avoir de quoi discriminer. */
export const MIN_QUERY_LENGTH = 2;

/**
 * Filtre et classe les entrées.
 *
 * Tous les mots de la requête doivent se retrouver (dans le titre OU le
 * sous-titre), sans exiger qu'ils soient contigus ni dans l'ordre : « vaccin
 * bella » doit trouver « Vaccin annuel » de Bella. C'est ce qu'on attend d'un
 * champ de recherche, et c'est la seule règle — pas de correspondance floue,
 * qui ramènerait du bruit qu'on ne saurait pas expliquer.
 *
 * Classement par date décroissante : ce qu'on cherche est presque toujours
 * récent, et à défaut on sait dans quel sens dérouler.
 */
export function searchEntries(entries: SearchResult[], query: string): SearchResult[] {
  const normalized = normalize(query).trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0 || normalized.length < MIN_QUERY_LENGTH) return [];
  return entries
    .filter((entry) => {
      const haystack = `${normalize(entry.title)} ${normalize(entry.subtitle)}`;
      return words.every((word) => haystack.includes(word));
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}
