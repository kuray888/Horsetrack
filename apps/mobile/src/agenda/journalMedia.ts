import { pickFileUrl } from "@/lib/mergeRemote";
import type { ColumnState } from "@/lib/schemaGaps";

/**
 * Photo et vidéo d'un souvenir — logique pure, testée (journalMedia.test.ts).
 * Envoi : lib/cloudSync.ts pushJournalEntry ; fusion : agenda/store.tsx.
 */

type JournalMedia = {
  horseId: string | null;
  photoUri: string | null;
  photoPath: string | null;
  videoUri?: string | null;
  videoPath?: string | null;
};

/**
 * Fichier resté sur le téléphone : l'envoi a échoué (réseau coupé pendant
 * une vidéo de 50 Mo, app fermée) alors que la ligne, elle, est arrivée. La
 * relecture ne le voit pas — la ligne existe côté serveur —, il faut donc le
 * renvoyer explicitement (une fois par lancement, cf. agenda/store.tsx),
 * comme les fichiers de documents (cf. retryPendingDocumentUploads).
 */
export function hasUnsentJournalMedia(entry: JournalMedia): boolean {
  if (!entry.horseId) return false;
  const photo = !!entry.photoUri?.startsWith("file://") && !entry.photoPath;
  const video = !!entry.videoUri?.startsWith("file://") && !entry.videoPath;
  return photo || video;
}

/**
 * Vidéo d'un souvenir relu du serveur.
 *
 * - `videoPath` undefined : la colonne n'existe pas encore côté serveur (cf.
 *   cloudSync pullJournalEntries) — la vidéo locale est gardée telle quelle.
 * - Colonne tout juste créée (cf. lib/schemaGaps.ts) : une vidéo envoyée
 *   avant, dont le chemin n'a pas pu être enregistré, est gardée et la ligne
 *   renvoyée (`resend`). Sans ça, la vidéo disparaissait du souvenir.
 * - Sinon, le serveur fait foi (vidéo retirée sur un autre appareil).
 */
export function mergeJournalVideo(
  local: JournalMedia,
  remote: JournalMedia,
  state: ColumnState
): { videoUri: string | null; videoPath: string | null; resend: boolean } {
  if (remote.videoPath === undefined) {
    return { videoUri: local.videoUri ?? null, videoPath: local.videoPath ?? null, resend: false };
  }
  if (state === "catching_up" && remote.videoPath === null && local.videoPath) {
    return { videoUri: local.videoUri ?? null, videoPath: local.videoPath, resend: true };
  }
  return {
    videoUri: pickFileUrl(local.videoUri ?? null, local.videoPath ?? null, remote.videoUri ?? null, remote.videoPath),
    videoPath: remote.videoPath,
    resend: false,
  };
}
