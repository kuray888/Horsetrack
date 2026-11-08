import { discardSupersededWrites, enqueueFailedWrite, flushSyncQueue, isStillQueued, operationStartedAt, type SyncOperation } from "@/lib/syncQueue";
import { supabase } from "@/lib/supabase";
import { confirmWrite, hasNewerWrite, loadRemoteIndex, recordWriteSuccess, serializeWrite } from "@/lib/remoteIndex";
import { clearRejectedWrite } from "@/lib/rejectedWrites";
import { noteColumnsRead } from "@/lib/schemaGaps";

/** Outils communs de la synchronisation (URLs signées, identifiants, règlement des écritures suivies, colonnes facultatives).
 * Extrait de lib/cloudSync.ts (façade) sans changement de comportement. */

/** Durée de validité des URLs signées Storage (photos cheval/document/journal),
 * régénérées uniquement à la connexion (cf. login.tsx) — pas à chaque
 * ouverture d'écran. 90 jours plutôt que 7 : réduit nettement le risque
 * qu'une image casse pendant une session longue sans déconnexion, seule
 * mitigation possible sans changement d'architecture (cf. audit technique
 * post-V1 : une vraie correction demanderait de régénérer l'URL à la
 * demande à l'affichage plutôt qu'une fois pour toutes au login — hors
 * périmètre ici, pas de changement RLS/Storage nécessaire pour ce réglage).
 */
export const SIGNED_URL_TTL_SECONDS = 90 * 24 * 60 * 60;
/** Signe plusieurs chemins d'un bucket en une requête par lot de 100 (au lieu
 * d'une requête par fichier) — les relectures régulières (cf.
 * lib/cloudRefresh.ts) resignent tout le coffre-fort et le journal. Chemin
 * absent de la réponse = pas d'URL (fichier supprimé, erreur). */
export async function signPaths(bucket: string, paths: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const unique = [...new Set(paths)];
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const { data } = await supabase.storage.from(bucket).createSignedUrls(chunk, SIGNED_URL_TTL_SECONDS);
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl && !entry.error) urls.set(entry.path, entry.signedUrl);
    }
  }
  return urls;
}
export function generateId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
/**
 * Rejoue les écritures mises en attente par une panne réseau (cf.
 * lib/syncQueue.ts). Appelée au démarrage, au retour de l'app au premier plan
 * (cf. app/_layout.tsx), et après chaque écriture réussie — une réussite est
 * le meilleur indice disponible que le réseau est revenu, et évite d'ajouter
 * une dépendance de détection de connectivité pour l'apprendre.
 */
export async function retryPendingWrites(): Promise<void> {
  // Les marques d'écritures non confirmées (cf. remoteIndex) décident de ce qui
  // est périmé ici : elles doivent être relues avant toute reprise — ce n'était
  // pas le cas de la reprise lancée dès le démarrage (cf. app/_layout.tsx).
  await loadRemoteIndex();
  await flushSyncQueue((operation: SyncOperation) => {
    // Dans la file de sa ligne : jamais en même temps qu'une écriture directe
    // de la même ligne, dont elle pourrait arriver après (cf. serializeWrite).
    // Une épreuve passe par celle de son rendez-vous, comme ses écritures
    // directes (cf. pushCompetitionEntry).
    const appointmentId = parentAppointmentId(operation);
    return appointmentId !== null
      ? serializeWrite("appointments", appointmentId, () => replayOperation(operation, appointmentId))
      : serializeWrite(operation.table, operation.id, () => replayOperation(operation, null));
  });
}
/** Rendez-vous d'une épreuve en file (upsert seulement : une suppression ne
 * porte pas de ligne). */
function parentAppointmentId(operation: SyncOperation): string | null {
  return operation.table === "competition_entries" && typeof operation.row?.appointmentId === "string"
    ? operation.row.appointmentId
    : null;
}
async function replayOperation(
  operation: SyncOperation,
  appointmentId: string | null
): Promise<{ error: { code?: string; message?: string } | null }> {
  const startedAt = operationStartedAt(operation);
  // Remplacée ou retirée pendant qu'elle attendait son tour (une écriture plus
  // récente de la même ligne a abouti, ou a échoué et pris sa place) : périmée.
  if (!isStillQueued(operation)) return { error: null };
  // Une modification plus récente de la même ligne est partie depuis (et a été
  // interrompue, ou est en cours) : cette ancienne version ne doit plus partir.
  // Rejouée, elle écrasait la nouvelle côté serveur et effaçait sa marque —
  // la relecture suivante remettait alors l'ancienne version à l'écran (cf.
  // audit du 2026-10-02). Retirée de la file sans envoi : la version locale,
  // plus récente, est renvoyée par la fusion (cf. syncGuard.needsResend,
  // resendUnconfirmedDeletes).
  if (
    hasNewerWrite(operation.table, operation.id, startedAt) ||
    (appointmentId !== null && hasNewerWrite("appointments", appointmentId, startedAt))
  ) {
    return { error: null };
  }
  const { error } =
    operation.op === "delete"
      ? await supabase.from(operation.table).delete().eq("id", operation.id)
      : await supabase.from(operation.table).upsert(operation.row ?? {});
  if (!error) {
    recordWriteSuccess(operation.table, operation.id, operation.op === "delete", startedAt);
    if (appointmentId !== null) confirmWrite("appointments", appointmentId, startedAt);
    clearRejectedWrite(operation.table, operation.id);
  }
  return { error };
}
/**
 * Sort commune de toutes les écritures : trace l'échec, met l'opération en
 * attente de reprise, et profite d'un succès pour vider ce qui attendait.
 *
 * `row` est la ligne déjà prête pour PostgREST (dates en ISO), donc rejouable
 * telle quelle. Sans `row`, l'opération est une suppression.
 */
/** Exporté pour les stores qui écrivent eux-mêmes dans Supabase (cf.
 * goals/store.tsx) : même file de reprise que les écritures de ce module. */
export async function settleRemoteWrite(
  label: string,
  table: string,
  id: string,
  error: { code?: string; message?: string } | null,
  row?: Record<string, unknown>,
  startedAt?: number
): Promise<void> {
  return settleWrite(label, table, id, error, row, startedAt);
}
export async function settleWrite(
  label: string,
  table: string,
  id: string,
  error: { code?: string; message?: string } | null,
  row?: Record<string, unknown>,
  /** Horodatage de départ de l'écriture (cf. remoteIndex.withWriteTracking). */
  stamp?: number
): Promise<void> {
  if (!error) {
    recordWriteSuccess(table, id, !row, stamp);
    clearRejectedWrite(table, id);
    // Les opérations plus anciennes sur cette même ligne sont périmées : les
    // retirer AVANT de vider la file, sinon elles écraseraient ce qu'on vient
    // d'écrire. Départ de l'écriture : son horodatage, à défaut son
    // `updatedAt` (posé juste avant l'envoi), à défaut maintenant.
    const fromRow = typeof row?.updatedAt === "string" ? Date.parse(row.updatedAt) : NaN;
    const startedAt = stamp ?? (Number.isFinite(fromRow) ? fromRow : Date.now());
    await discardSupersededWrites({ table, id }, startedAt).catch(() => {});
    // Le réseau répond : c'est le moment de rejouer ce qui attendait.
    retryPendingWrites().catch(() => {});
    return;
  }
  console.warn(`[cloudSync] ${label} échoué`, error);
  await enqueueFailedWrite({ table, op: row ? "upsert" : "delete", id, row, startedAt: stamp }, error);
}
export async function getOwnerProfile(userId: string): Promise<{ id: string; onboardingCompletedAt: string | null } | null> {
  const { data } = await supabase
    .from("rider_profiles")
    .select("id, onboardingCompletedAt")
    .eq("userId", userId)
    .maybeSingle();
  return data ?? null;
}
/**
 * Colonnes ajoutées après coup (activityKind, videoPath…) : tant que la base
 * n'a pas reçu le SQL correspondant, un upsert qui les contient serait refusé
 * en entier, et la ligne ne se synchroniserait plus du tout. On retente alors
 * sans elles : le reste est sauvegardé, seules ces colonnes attendent — même
 * principe que pushAppointment (competitionLevel/endDate).
 */
function mentionsColumn(error: { message?: string } | null, columns: string[]): boolean {
  const message = (error?.message ?? "").toLowerCase();
  return columns.some((c) => message.includes(c.toLowerCase()));
}
export async function upsertWithOptionalColumns(
  label: string,
  table: string,
  id: string,
  row: Record<string, unknown>,
  optional: string[],
  stamp?: number
): Promise<{ message?: string } | null> {
  const { error } = await supabase.from(table).upsert(row);
  if (error && mentionsColumn(error, optional)) {
    const base = Object.fromEntries(Object.entries(row).filter(([k]) => !optional.includes(k)));
    const { error: retryError } = await supabase.from(table).upsert(base);
    // En attente, c'est la ligne SANS ces colonnes qu'on garde : rejouer la
    // version complète buterait sur le même schéma.
    await settleWrite(label, table, id, retryError, base, stamp);
    return retryError;
  }
  await settleWrite(label, table, id, error, row, stamp);
  return error;
}
/** Lecture avec colonnes optionnelles, repli sans elles si la base ne les a
 * pas. Ce qui a été vu est noté (cf. lib/schemaGaps.ts) : les lignes écrites
 * sans ces colonnes seront rattrapées une fois le SQL exécuté. */
export async function selectWithOptionalColumns<T>(table: string, base: string, optional: string[]): Promise<T[] | null> {
  const full = await supabase.from(table).select([base, ...optional].join(", "));
  if (!full.error && full.data) {
    await noteColumnsRead(table, optional, true);
    return full.data as T[];
  }
  if (!mentionsColumn(full.error, optional)) return null;
  const fallback = await supabase.from(table).select(base);
  if (fallback.error || !fallback.data) return null;
  await noteColumnsRead(table, optional, false);
  return fallback.data as T[];
}
