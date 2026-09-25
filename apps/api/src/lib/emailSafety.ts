/**
 * Texte saisi par un utilisateur (nom de cheval, nom affiché, titre de rappel)
 * et inséré dans un email envoyé depuis le domaine Horsetrack : on neutralise
 * tout ce qu'un client mail transformerait en lien cliquable, pour que nos
 * emails ne puissent pas servir à relayer du hameçonnage.
 *
 * - « http://x », « https://x » → « http x » ;
 * - « www.x » → « www x » ;
 * - « exemple.com » → « exemple․com » (point de conduite U+2024, visuellement
 *   proche, jamais reconnu comme domaine). Seul un point collé entre une
 *   lettre/chiffre et au moins deux lettres est touché : « 14.30 » ou
 *   « Dr. Martin » restent intacts.
 */
export function neutralizeLinks(text: string): string {
  return text
    .replace(/:\/\//g, " ")
    .replace(/\bwww\./gi, "www ")
    .replace(/([A-Za-z0-9])\.(?=[A-Za-z]{2,})/g, "$1․");
}

/** Une ligne (sujet, nom) : liens neutralisés, sauts de ligne retirés, tronquée. */
export function safeLine(text: string | null | undefined, max: number): string {
  const clean = neutralizeLinks((text ?? "").replace(/[\r\n\t]+/g, " ").trim());
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Un bloc de texte (corps) : liens neutralisés, tronqué, sauts de ligne gardés. */
export function safeBlock(text: string, max: number): string {
  const clean = neutralizeLinks(text.trim());
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
