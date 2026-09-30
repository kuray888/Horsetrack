import { Directory, File, Paths } from "expo-file-system";

/**
 * Fichiers personnels copiés dans le dossier Documents de l'app par
 * lib/imagePicker.ts : photos de cheval/journal (`horse-<horodatage>.jpg`) et
 * pièces du coffre-fort (`document-<horodatage>.<ext>`).
 *
 * La suppression de compte vidait les listes (fichiers `store-*.json`, cf.
 * lib/localStore.ts) mais laissait ces fichiers sur l'appareil, indéfiniment
 * et sans plus aucune référence — alors que la politique de confidentialité
 * promet une suppression complète (ordonnances, factures…), et que le
 * prochain compte créé sur ce téléphone les avait à portée (cf. audit du
 * 2026-09-30). Motif volontairement étroit : jamais un fichier dont on ne
 * connaît pas l'origine.
 */
const ACCOUNT_MEDIA_NAME = /^(horse|document)-\d+\.(jpg|jpeg|png|pdf|heic|heif|webp)$/i;

export function isAccountMediaFileName(name: string): boolean {
  return ACCOUNT_MEDIA_NAME.test(name);
}

/** Supprime ces fichiers. Best-effort : ne lève jamais, renvoie le nombre de
 * fichiers effacés. */
export function purgeAccountMediaFiles(): number {
  let removed = 0;
  try {
    for (const entry of new Directory(Paths.document).list()) {
      if (!(entry instanceof File) || !isAccountMediaFileName(entry.name)) continue;
      try {
        entry.delete();
        removed++;
      } catch {
        // Fichier suivant : un échec isolé ne doit pas arrêter la purge.
      }
    }
  } catch (e) {
    console.warn("[localMedia] purge des fichiers locaux échouée", e);
  }
  return removed;
}
