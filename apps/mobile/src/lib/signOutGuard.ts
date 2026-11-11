import { hasUnsentJournalMedia, type JournalMedia } from "@/agenda/journalMedia";

/**
 * Saisies de cet appareil que le serveur n'a pas encore reçues, à annoncer
 * avant une déconnexion. Elles ne sont pas perdues si l'on se reconnecte au
 * même compte, mais un autre compte connecté ensuite sur ce téléphone vide
 * la file d'attente et les données locales (cf. (auth)/login.tsx,
 * syncQueue.clearSyncQueue) : sans avertissement, elles disparaissaient sans
 * que personne le sache (cf. audit du 2026-11-11).
 */
export function unsentCountBeforeSignOut(input: {
  pendingWrites: number;
  documents: readonly { fileUri?: string | null; filePath?: string | null }[];
  journal: readonly JournalMedia[];
}): number {
  const unsentDocuments = input.documents.filter((d) => !d.filePath && !!d.fileUri?.startsWith("file://")).length;
  const unsentMedia = input.journal.filter(hasUnsentJournalMedia).length;
  return input.pendingWrites + unsentDocuments + unsentMedia;
}
