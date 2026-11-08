import { pendingIdsFor } from "@/lib/syncQueue";
import { supabase } from "@/lib/supabase";
import { beginWrite, confirmWrite, endWrite, unconfirmedDeletes, withWriteTracking } from "@/lib/remoteIndex";
import type { Horse } from "@/horses/store";
import type { Appointment, CompetitionEntry, Doc, Expense, JournalEntry } from "@/agenda/store";
import type { TrainingSession } from "@/sessions/store";
import type { SessionRide } from "@/rides/types";
import type { Contact, HorseDetails } from "@/extras/model";
import { hasUnsentJournalMedia } from "@/agenda/journalMedia";
import type { WeightMeasurement } from "@/horses/weightStore";
import { deleteAppointmentRemoteImpl, pushAppointmentImpl, pushCompetitionEntryImpl } from "./sync/appointments";
import { deleteDocumentRemoteImpl, pushDocumentImpl } from "./sync/documents";
import { deleteExpenseRemoteImpl, pushExpenseImpl } from "./sync/expenses";
import { deleteContactRemoteImpl, pushContactImpl, pushHorseDetailsImpl } from "./sync/extras";
import { deleteHorseRemoteImpl, pushHorsesImpl } from "./sync/horses";
import { deleteJournalEntryRemoteImpl, pushJournalEntryImpl } from "./sync/journal";
import { deleteTrainingSessionRemoteImpl, pushSessionRideImpl, pushTrainingSessionImpl } from "./sync/sessions";
import { settleWrite } from "./sync/shared";
import { deleteWeightMeasurementRemoteImpl, pushWeightMeasurementImpl } from "./sync/weight";
import { deleteRideSlotRemoteImpl, pushRideSlotImpl } from "./sync/slots";
import type { RideSlot } from "@/planning/slots";

/**
 * Sauvegarde cloud des données irremplaçables (écurie + profil cavalier,
 * coffre-fort, calendrier, progression + programme d'entraînement) — ce
 * qu'on perdrait sans ça sur changement de téléphone ou réinstallation.
 * Best-effort partout : un échec réseau ne doit jamais bloquer l'usage de
 * l'app, seulement retarder la sauvegarde au prochain appel.
 *
 * Les ids locaux (Horse.id, Injury.id) servent aussi d'id Postgres — pas de
 * table de correspondance à maintenir, un push réutilise toujours la même
 * ligne plutôt que d'en créer une nouvelle à chaque appel.
 */

// API publique déplacée par domaine dans lib/sync/ — réexportée ici, inchangée.
export { pullAppointments } from "./sync/appointments";
export { pullDocuments } from "./sync/documents";
export { pullExpenses } from "./sync/expenses";
export { pullHorseDetails, pullContacts } from "./sync/extras";
export { pushRiderProfile, deleteHorsePhotoRemote, pullCloudData, type RemoteTrait, type RemoteInjury, type RemoteHorse, mapRemoteHorse } from "./sync/horses";
export { pullJournalEntries } from "./sync/journal";
export { pullTrainingSessions } from "./sync/sessions";
export { retryPendingWrites, settleRemoteWrite } from "./sync/shared";
export { pullWeightMeasurements } from "./sync/weight";
export { pullRideSlots, migratePartnershipSlots } from "./sync/slots";

/**
 * Suppression d'une épreuve. Deux marques durables, posées avant l'envoi :
 * - sur l'épreuve, en suppression : interrompue par une fermeture de l'app,
 *   elle est renvoyée au lancement (cf. resendUnconfirmedDeletes) ;
 * - sur son rendez-vous : la relecture ne remet pas l'épreuve à l'écran tant
 *   que la suppression n'est pas confirmée.
 * Avant, rien n'était noté : app fermée pendant l'envoi, l'épreuve revenait à
 * la relecture suivante et restait sur le serveur (cf. audit du 2026-10-02).
 */
export function deleteCompetitionEntryRemote(appointmentId: string, entryId: string): Promise<void> {
  return withWriteTracking("appointments", appointmentId, (appointmentStamp) =>
    withWriteTracking(
      "competition_entries",
      entryId,
      async (stamp) => {
        const { error } = await supabase.from("competition_entries").delete().eq("id", entryId);
        await settleWrite("deleteCompetitionEntryRemote", "competition_entries", entryId, error, undefined, stamp);
        if (!error) confirmWrite("appointments", appointmentId, appointmentStamp);
      },
      "delete"
    )
  );
}
/**
 * Documents dont le fichier n'est jamais parti (création hors ligne, réseau
 * coupé pendant l'envoi) : fichier encore uniquement local (`file://`) et
 * aucun chemin distant. Sans cette reprise, le document restait sans fichier
 * côté serveur — invisible après une réinstallation ou sur un autre appareil.
 * Renvoie les chemins obtenus, à reporter dans l'état local.
 */
export async function retryPendingDocumentUploads(docs: Doc[]): Promise<{ id: string; filePath: string }[]> {
  const pending = docs.filter((d) => !d.filePath && d.fileUri?.startsWith("file://"));
  const done: { id: string; filePath: string }[] = [];
  for (const doc of pending) {
    const filePath = await pushDocument(doc).catch(() => null);
    if (filePath) done.push({ id: doc.id, filePath });
  }
  return done;
}
/**
 * Reprise des photos et vidéos de souvenirs jamais envoyées (cf.
 * agenda/journalMedia.ts hasUnsentJournalMedia), même principe que
 * retryPendingDocumentUploads. Renvoie les chemins obtenus, à reporter dans
 * l'état local.
 */
export async function retryPendingJournalUploads(
  entries: JournalEntry[]
): Promise<{ id: string; photoPath: string | null; videoPath: string | null }[]> {
  const done: { id: string; photoPath: string | null; videoPath: string | null }[] = [];
  for (const entry of entries.filter(hasUnsentJournalMedia)) {
    const sent = await pushJournalEntry(entry).catch(() => null);
    if (sent) done.push({ id: entry.id, ...sent });
  }
  return done;
}
export function pushDocument(doc: Doc) {
  return withWriteTracking("documents", doc.id, (stamp) => pushDocumentImpl(doc, stamp));
}
export function deleteDocumentRemote(docId: string, filePath: string | null) {
  return withWriteTracking("documents", docId, (stamp) => deleteDocumentRemoteImpl(docId, filePath, stamp), "delete");
}
export function pushAppointment(appt: Appointment) {
  return withWriteTracking("appointments", appt.id, (stamp) => pushAppointmentImpl(appt, stamp));
}
export function deleteAppointmentRemote(apptId: string) {
  return withWriteTracking("appointments", apptId, (stamp) => deleteAppointmentRemoteImpl(apptId, stamp), "delete");
}
/**
 * Épreuve d'un concours : suivie sous son RENDEZ-VOUS, avec une marque durable.
 * Les épreuves vivent dans le rendez-vous côté app ; c'est donc le rendez-vous
 * que la relecture doit garder tel quel tant que l'épreuve n'est pas confirmée,
 * et lui qui est renvoyé (épreuves comprises) si l'app est fermée pendant
 * l'envoi (cf. agenda/store.tsx mergeFromCloud). Sans marque durable, une
 * épreuve ajoutée ou un résultat saisi juste avant de quitter l'app
 * disparaissait à la relecture suivante (cf. audit du 2026-10-02).
 */
export function pushCompetitionEntry(appointmentId: string, entry: CompetitionEntry) {
  return withWriteTracking("appointments", appointmentId, (stamp) => pushCompetitionEntryImpl(appointmentId, entry, stamp));
}
/**
 * Rendez-vous ET ses épreuves (création, renvoi après relecture). Tous lancés
 * d'un coup : la file de la ligne (cf. remoteIndex.serializeWrite) les envoie
 * dans l'ordre — le rendez-vous d'abord, que la règle RLS des épreuves exige
 * — et la marque du rendez-vous ne tombe qu'à la confirmation de la dernière
 * épreuve. Avant, les épreuves partaient après la réponse au rendez-vous, qui
 * levait la marque : fermée entre les deux, l'app perdait les épreuves.
 */
export function pushAppointmentWithEntries(appt: Appointment): Promise<void> {
  const writes = [pushAppointment(appt), ...appt.competitionEntries.map((entry) => pushCompetitionEntry(appt.id, entry))];
  return Promise.all(writes.map((w) => w.catch(() => {}))).then(() => {});
}
export function pushJournalEntry(entry: JournalEntry) {
  return withWriteTracking("journal_entries", entry.id, (stamp) => pushJournalEntryImpl(entry, stamp));
}
export function deleteJournalEntryRemote(entryId: string, horseId: string | null) {
  return withWriteTracking("journal_entries", entryId, (stamp) => deleteJournalEntryRemoteImpl(entryId, horseId, stamp), "delete");
}
export function pushTrainingSession(session: TrainingSession) {
  return withWriteTracking("training_sessions", session.id, (stamp) => pushTrainingSessionImpl(session, stamp));
}
export function pushHorseDetails(details: HorseDetails) {
  return withWriteTracking("horse_details", details.horseId, (stamp) => pushHorseDetailsImpl(details, stamp));
}
export function pushContact(contact: Contact) {
  return withWriteTracking("rider_contacts", contact.id, (stamp) => pushContactImpl(contact, stamp));
}
export function deleteContactRemote(id: string) {
  return withWriteTracking("rider_contacts", id, (stamp) => deleteContactRemoteImpl(id, stamp), "delete");
}
export function pushSessionRide(sessionId: string, horseId: string, ride: SessionRide) {
  return withWriteTracking("training_session_rides", sessionId, (stamp) =>
    pushSessionRideImpl(sessionId, horseId, ride, stamp)
  );
}
export function deleteTrainingSessionRemote(sessionId: string) {
  return withWriteTracking("training_sessions", sessionId, (stamp) => deleteTrainingSessionRemoteImpl(sessionId, stamp), "delete");
}
export function pushWeightMeasurement(measurement: WeightMeasurement) {
  return withWriteTracking("horse_weight_measurements", measurement.id, (stamp) => pushWeightMeasurementImpl(measurement, stamp));
}
export function deleteWeightMeasurementRemote(id: string) {
  return withWriteTracking("horse_weight_measurements", id, (stamp) => deleteWeightMeasurementRemoteImpl(id, stamp), "delete");
}
export function pushRideSlot(slot: RideSlot) {
  return withWriteTracking("ride_slots", slot.id, (stamp) => pushRideSlotImpl(slot, stamp));
}
export function deleteRideSlotRemote(id: string) {
  return withWriteTracking("ride_slots", id, (stamp) => deleteRideSlotRemoteImpl(id, stamp), "delete");
}
export function pushExpense(expense: Expense) {
  return withWriteTracking("expenses", expense.id, (stamp) => pushExpenseImpl(expense, stamp));
}
export function deleteExpenseRemote(expenseId: string) {
  return withWriteTracking("expenses", expenseId, (stamp) => deleteExpenseRemoteImpl(expenseId, stamp), "delete");
}
export function deleteHorseRemote(horseId: string) {
  return withWriteTracking("horses", horseId, (stamp) => deleteHorseRemoteImpl(horseId, stamp), "delete");
}
/**
 * Renvoie les suppressions parties sans confirmation (app fermée pendant
 * l'envoi, cf. remoteIndex `unconfirmed`) : la ligne a disparu de l'appareil
 * mais existe encore sur le serveur, donc chez la demi-pension et sur les
 * autres appareils. Celles déjà en file de reprise sont laissées à la file.
 * Best-effort, ne rejette jamais.
 */
export async function resendUnconfirmedDeletes(): Promise<void> {
  for (const { table, id } of unconfirmedDeletes()) {
    if (pendingIdsFor(table).has(id)) continue;
    try {
      if (table === "horses") {
        await deleteHorseRemote(id);
      } else if (table === "documents") {
        // Le chemin du fichier n'est plus connu (la ligne a disparu d'ici) :
        // seule la ligne est supprimée, le fichier reste inaccessible (RLS).
        await deleteDocumentRemote(id, null);
      } else {
        await withWriteTracking(
          table,
          id,
          async (stamp) => {
            const { error } = await supabase.from(table).delete().eq("id", id);
            await settleWrite(`resendDelete:${table}`, table, id, error, undefined, stamp);
          },
          "delete"
        );
      }
    } catch (e) {
      console.warn("[cloudSync] renvoi d'une suppression échoué", table, e);
    }
  }
}
/** Envoi de l'écurie, suivi cheval par cheval (cf. withWriteTracking). */
export async function pushHorses(horses: Horse[], onlyIds?: string[]): ReturnType<typeof pushHorsesImpl> {
  const ids = (onlyIds ? horses.filter((h) => onlyIds.includes(h.id)) : horses).map((h) => h.id);
  ids.forEach((id) => beginWrite("horses", id));
  try {
    return await pushHorsesImpl(horses, onlyIds);
  } finally {
    ids.forEach((id) => endWrite("horses", id));
  }
}
