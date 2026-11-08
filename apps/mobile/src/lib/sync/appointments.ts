import { supabase } from "@/lib/supabase";
import { confirmWrite } from "@/lib/remoteIndex";
import { parseServerDate, parseServerDateOrNull } from "@/lib/serverDate";
import type { Appointment, CompetitionEntry } from "@/agenda/store";
import { settleWrite } from "./shared";

/** Rendez-vous, concours et épreuves.
 * Extrait de lib/cloudSync.ts (façade) sans changement de comportement. */

function appointmentTypeToDb(type: Appointment["type"]): string {
  return type.toUpperCase();
}
function appointmentTypeFromDb(type: string): Appointment["type"] {
  return type.toLowerCase() as Appointment["type"];
}
/** Pas de push si l'entrée n'est pas encore rattachée à un cheval (cf.
 * agenda/store.tsx, backfill au chargement) — rien à synchroniser tant
 * qu'aucun horseId n'est connu. */
export async function pushAppointmentImpl(appt: Appointment, stamp?: number): Promise<void> {
  if (!appt.horseId) return;
  const row = {
    id: appt.id,
    horseId: appt.horseId,
    type: appointmentTypeToDb(appt.type),
    title: appt.title,
    date: appt.date.toISOString(),
    time: appt.time,
    location: appt.location,
    notes: appt.notes,
    reminder: appt.reminder,
    result: appt.result,
    checklist: appt.checklist,
    dossard: appt.dossard,
    professional: appt.professional,
    cost: appt.cost,
    nextDueDate: appt.nextDueDate?.toISOString() ?? null,
    updatedAt: new Date().toISOString(),
  };
  const fullRow = { ...row, competitionLevel: appt.competitionLevel, endDate: appt.endDate?.toISOString() ?? null };
  const { error } = await supabase.from("appointments").upsert(fullRow);
  if (!error) {
    await settleWrite("pushAppointment", "appointments", appt.id, null, fullRow, stamp);
    return;
  }
  // Colonnes `competitionLevel`/`endDate` ajoutées après coup : tant que la base
  // n'a pas reçu la migration (`pnpm db:push`), l'upsert entier serait refusé et
  // AUCUN rendez-vous ne se synchroniserait plus. On retente sans elles : le
  // reste du rendez-vous est sauvegardé, seuls niveau et date de fin attendent.
  if (isMissingAppointmentColumnError(error)) {
    const { error: retryError } = await supabase.from("appointments").upsert(row);
    // En attente de reprise, c'est la ligne SANS ces colonnes qu'on garde :
    // rejouer la version complète buterait sur le même schéma non migré.
    await settleWrite("pushAppointment", "appointments", appt.id, retryError, row, stamp);
    return;
  }
  await settleWrite("pushAppointment", "appointments", appt.id, error, fullRow, stamp);
}
/** Vrai si l'erreur PostgREST/Postgres vient de l'absence de `competitionLevel`
 * ou `endDate` dans la table (schéma pas encore migré). */
function isMissingAppointmentColumnError(error: { message?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  return message.includes("competitionlevel") || message.includes("enddate");
}
export async function deleteAppointmentRemoteImpl(apptId: string, stamp?: number): Promise<void> {
  const { error } = await supabase.from("appointments").delete().eq("id", apptId);
  await settleWrite("deleteAppointmentRemote", "appointments", apptId, error, undefined, stamp);
}
/** Restaure les rendez-vous visibles par l'utilisateur courant — possédés ET
 * partagés (cf. ci-dessus, géré entièrement par RLS). Les épreuves sont
 * restaurées via la jointure imbriquée `competition_entries(*)` (même
 * technique que `pullCloudData` pour horse_traits/horse_injuries), pas un
 * appel séparé. */
export async function pullAppointments(): Promise<Appointment[] | null> {
  const baseColumns =
    "id, horseId, type, title, date, time, location, notes, reminder, result, checklist, dossard, professional, cost, nextDueDate";
  const entries = "competition_entries(id, name, discipline, time, result)";
  // Épreuves dans leur ordre de création, celui de l'écran. Sans ordre
  // explicite, Postgres les rend dans un ordre quelconque — en pratique, une
  // épreuve modifiée (heure ajoutée après coup) passait en dernier à la
  // relecture suivante. L'identifiant départage deux créations simultanées.
  const entriesOrder = { referencedTable: "competition_entries" };
  let { data, error } = await supabase
    .from("appointments")
    .select(`${baseColumns}, competitionLevel, endDate, ${entries}`)
    .order("createdAt", entriesOrder)
    .order("id", entriesOrder);
  // Base pas encore migrée (cf. pushAppointment) : sans ce repli, sélectionner
  // une colonne inconnue ferait échouer TOUTE la restauration des rendez-vous.
  if (error && isMissingAppointmentColumnError(error)) {
    const fallback = await supabase
      .from("appointments")
      .select(`${baseColumns}, ${entries}`)
      .order("createdAt", entriesOrder)
      .order("id", entriesOrder);
    // Lignes sans niveau ni date de fin : lus plus bas comme absents.
    data = fallback.data as typeof data;
    error = fallback.error;
  }
  if (error || !data) return null;
  return data.map((row) => ({
    id: row.id,
    horseId: row.horseId,
    type: appointmentTypeFromDb(row.type),
    title: row.title,
    date: parseServerDate(row.date),
    time: row.time,
    location: row.location,
    notes: row.notes,
    reminder: row.reminder as Appointment["reminder"],
    // Jamais synchronisés (cf. schema.prisma Appointment) : identifiants de
    // planification propres à l'appareil/au compte qui a créé le rappel.
    reminderNotificationId: null,
    emailReminderId: null,
    nextDueNotificationId: null,
    result: row.result ?? null,
    checklist: (row.checklist as Appointment["checklist"]) ?? [],
    dossard: row.dossard ?? null,
    professional: row.professional ?? null,
    cost: row.cost === null || row.cost === undefined ? null : Number(row.cost),
    nextDueDate: parseServerDateOrNull(row.nextDueDate),
    competitionLevel: normalizeCompetitionLevel((row as { competitionLevel?: unknown }).competitionLevel),
    endDate: parseServerDateOrNull((row as { endDate?: string | null }).endDate),
    competitionEntries: ((row.competition_entries ?? []) as RemoteCompetitionEntry[]).map((e) => ({
      id: e.id,
      name: e.name,
      discipline: e.discipline as CompetitionEntry["discipline"],
      // Épreuve sans heure de passage : chaîne vide (cf. agenda/competitionEntry.ts).
      time: e.time ?? "",
      result: e.result ?? null,
    })),
  }));
}
function normalizeCompetitionLevel(value: unknown): Appointment["competitionLevel"] {
  return value === "national" || value === "international" ? value : null;
}
type RemoteCompetitionEntry = { id: string; name: string; discipline: string; time: string | null; result: string | null };
/** Une épreuve à la fois (upsert) — même logique que les documents (cf.
 * pushDocument) : pas d'opération de remplacement en masse, le volume par
 * rendez-vous reste faible. */
export async function pushCompetitionEntryImpl(appointmentId: string, entry: CompetitionEntry, stamp?: number): Promise<void> {
  const row = {
    id: entry.id,
    appointmentId,
    name: entry.name,
    discipline: entry.discipline,
    time: entry.time,
    result: entry.result,
    updatedAt: new Date().toISOString(),
  };
  const { error } = await supabase.from("competition_entries").upsert(row);
  await settleWrite("pushCompetitionEntry", "competition_entries", entry.id, error, row, stamp);
  // Confirme aussi la marque posée sur le rendez-vous (cf. pushCompetitionEntry).
  if (!error && stamp !== undefined) confirmWrite("appointments", appointmentId, stamp);
}
