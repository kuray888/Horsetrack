/**
 * Chemin distant d'une photo ou vidéo (bucket « horse-photos »), dérivé du
 * nom du fichier local. Le sélecteur nomme chaque fichier choisi de façon
 * unique (cf. lib/imagePicker.ts, `horse-<horodatage>.jpg`) :
 * - le même fichier renvoyé deux fois garde le même chemin (écrasé, rien ne
 *   s'accumule) ;
 * - une nouvelle photo obtient un nouveau chemin.
 *
 * Avant, le chemin était fixe (`{horseId}/photo.jpg`) : une photo remplacée
 * gardait le même chemin, l'autre appareil (et la demi-pension) gardait donc
 * son URL signée encore valable et l'image en cache, et montrait l'ancienne
 * photo pendant des semaines (cf. mergeRemote.pickFileUrl, audit du
 * 2026-11-11). Les anciens chemins restent lisibles : la base garde le chemin
 * de chaque fichier (`photoPath`).
 */
export function versionedMediaPath(folder: string, base: string, localUri: string, ext: string): string {
  const name = localUri.split("/").pop() ?? "";
  const stem = name.replace(/\.[^.]*$/, "").replace(/[^A-Za-z0-9_-]/g, "").slice(-48);
  return stem ? `${folder}/${base}-${stem}.${ext}` : `${folder}/${base}.${ext}`;
}

/** Début du nom de fichier de tous les médias d'un souvenir (anciens chemins
 * `{entryId}.jpg` compris), pour les retrouver à la suppression. */
export function journalMediaPrefix(entryId: string): string {
  return entryId;
}
