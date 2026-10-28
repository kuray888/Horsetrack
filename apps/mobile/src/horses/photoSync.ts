/**
 * Chevaux dont la photo n'existe que sur ce téléphone : choisie localement
 * (`file://`), jamais enregistrée côté serveur (aucun `photoPath`, ni ici ni
 * dans la relecture). Jusqu'au correctif du 2026-10-01, c'était le cas de tout
 * cheval CRÉÉ avec sa photo (cf. cloudSync.pushHorsesImpl, photo refusée par
 * le stockage tant que le cheval n'est pas en base) et jamais modifié depuis :
 * sa photo disparaissait au changement d'appareil ou à la reconnexion.
 *
 * `fileExists` écarte une photo dont le fichier a disparu (rien à envoyer, et
 * la retenter à chaque relecture ne servirait à rien). Pure, pour les tests.
 */
export function horseIdsWithUnsentPhoto(
  local: readonly { id: string; photoUrl: string | null; photoPath: string | null; sharedRole?: unknown }[],
  remoteOwned: readonly { id: string; photoPath: string | null }[],
  fileExists: (uri: string) => boolean
): string[] {
  const remotePath = new Map(remoteOwned.map((h) => [h.id, h.photoPath]));
  return local
    .filter(
      (h) =>
        !h.sharedRole &&
        !!h.photoUrl?.startsWith("file://") &&
        !h.photoPath &&
        remotePath.has(h.id) &&
        !remotePath.get(h.id) &&
        fileExists(h.photoUrl)
    )
    .map((h) => h.id);
}
