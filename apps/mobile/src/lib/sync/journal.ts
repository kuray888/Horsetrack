import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase";
import { parseServerDate } from "@/lib/serverDate";
import type { JournalEntry } from "@/agenda/store";
import { activityFromServer, activityToServer } from "@/agenda/activityKinds";
import { selectWithOptionalColumns, settleWrite, signPaths, upsertWithOptionalColumns } from "./shared";

/** Journal : souvenirs, photos et vidéos.
 * Extrait de lib/cloudSync.ts (façade) sans changement de comportement. */

function moodToDb(mood: JournalEntry["mood"]): string {
  return mood.toUpperCase();
}
function moodFromDb(mood: string): JournalEntry["mood"] {
  return mood.toLowerCase() as JournalEntry["mood"];
}
/** "Photo du jour" optionnelle d'une entrée de journal — même bucket que la
 * photo de profil du cheval ("horse-photos", cf. uploadHorsePhoto), dans un
 * sous-dossier "journal/" : les policies horse_photos_select_shared/write_own
 * ne filtrent que sur le premier segment du chemin (horseId), donc ce
 * sous-dossier est déjà couvert sans modification RLS. Chemin déterministe
 * "{horseId}/journal/{entryId}.jpg" — un nouvel upload écrase l'ancien objet
 * (upsert), même logique que uploadHorsePhoto/uploadDocumentPhoto. */
async function uploadJournalPhoto(horseId: string, entryId: string, localUri: string): Promise<string | null> {
  try {
    const bytes = await new File(localUri).bytes();
    const path = `${horseId}/journal/${entryId}.jpg`;
    const { error } = await supabase.storage.from("horse-photos").upload(path, bytes, {
      contentType: "image/jpeg",
      upsert: true,
    });
    return error ? null : path;
  } catch {
    return null;
  }
}
/** Vidéo d'un souvenir (Premium) : même bucket et même règle d'accès que la
 * photo (sous-dossier "journal/", réservé au Premium, cf. rls.sql). */
async function uploadJournalVideo(horseId: string, entryId: string, localUri: string): Promise<string | null> {
  try {
    const bytes = await new File(localUri).bytes();
    const path = `${horseId}/journal/${entryId}.mp4`;
    const { error } = await supabase.storage.from("horse-photos").upload(path, bytes, {
      contentType: "video/mp4",
      upsert: true,
    });
    return error ? null : path;
  } catch {
    return null;
  }
}
/** Upload la photo et la vidéo (si locales) puis upsert la ligne — même logique que
 * pushDocument : retourne les chemins `photoPath`/`videoPath` résultants, à reporter localement par
 * l'appelant (cf. agenda/store.tsx addJournalEntry/updateJournalEntry) pour ne
 * pas re-uploader la même photo à la prochaine synchro. `entry.photoUri` ne
 * vaut "file://…" QUE pour une photo locale pas encore envoyée (premier envoi
 * ou remplacement lors d'une édition, cf. updateJournalEntry). */
export async function pushJournalEntryImpl(
  entry: JournalEntry,
  stamp?: number
): Promise<{ photoPath: string | null; videoPath: string | null } | null> {
  if (!entry.horseId) return null;

  let photoPath = entry.photoPath;
  if (entry.photoUri?.startsWith("file://")) {
    const uploaded = await uploadJournalPhoto(entry.horseId, entry.id, entry.photoUri);
    if (uploaded) photoPath = uploaded;
  }
  let videoPath = entry.videoPath ?? null;
  if (entry.videoUri?.startsWith("file://")) {
    const uploaded = await uploadJournalVideo(entry.horseId, entry.id, entry.videoUri);
    if (uploaded) videoPath = uploaded;
  } else if (!entry.videoUri && videoPath) {
    // Vidéo retirée du souvenir : supprimée du serveur aussi.
    await supabase.storage.from("horse-photos").remove([videoPath]).catch(() => {});
    videoPath = null;
  }

  const row = {
    id: entry.id,
    horseId: entry.horseId,
    ...activityToServer(entry.activityType),
    mood: moodToDb(entry.mood),
    notes: entry.notes,
    date: entry.date.toISOString(),
    time: entry.time,
    weather: entry.weather,
    photoPath,
    videoPath,
    updatedAt: new Date().toISOString(),
  };
  const error = await upsertWithOptionalColumns(
    "pushJournalEntry",
    "journal_entries",
    entry.id,
    row,
    ["activityKind", "videoPath", "createdByUserId"],
    stamp
  );
  // La photo, elle, n'est pas rejouable depuis la file (l'upload Storage a
  // lieu plus haut, hors de la ligne) : on ne renvoie son chemin que si
  // l'entrée est bien partie, pour ne pas l'enregistrer localement comme
  // synchronisée alors qu'elle ne l'est pas.
  return error ? null : { photoPath, videoPath };
}
/** `horseId` nécessaire pour supprimer aussi la photo distante (cf. ci-dessus,
 * chemin scopé par cheval) — best-effort comme deleteDocumentRemote : si
 * l'objet Storage ne se supprime pas, RLS empêche de toute façon tout accès
 * par un autre utilisateur que le propriétaire/un collaborateur du cheval
 * déjà supprimé, pas une fuite. */
export async function deleteJournalEntryRemoteImpl(entryId: string, horseId: string | null, stamp?: number): Promise<void> {
  const { error } = await supabase.from("journal_entries").delete().eq("id", entryId);
  await settleWrite("deleteJournalEntryRemote", "journal_entries", entryId, error, undefined, stamp);
  if (horseId) {
    await supabase.storage
      .from("horse-photos")
      .remove([`${horseId}/journal/${entryId}.jpg`, `${horseId}/journal/${entryId}.mp4`]);
  }
}
type JournalRow = {
  id: string;
  horseId: string;
  activityType: string;
  activityKind?: string | null;
  mood: string;
  notes: string;
  date: string;
  time: string;
  weather: unknown;
  photoPath: string | null;
  videoPath?: string | null;
  createdByUserId?: string | null;
};
export async function pullJournalEntries(): Promise<JournalEntry[] | null> {
  const data = await selectWithOptionalColumns<JournalRow>(
    "journal_entries",
    "id, horseId, activityType, mood, notes, date, time, weather, photoPath",
    ["activityKind", "videoPath"]
  );
  if (!data) return null;
  const entries: JournalEntry[] = [];
  const signedPhotos = await signPaths(
    "horse-photos",
    data.flatMap((row) => [row.photoPath, row.videoPath ?? null]).filter((p): p is string => !!p)
  );
  for (const row of data) {
    const photoUri = row.photoPath ? (signedPhotos.get(row.photoPath) ?? null) : null;
    entries.push({
      id: row.id,
      horseId: row.horseId,
      activityType: activityFromServer(row.activityType, row.activityKind),
      mood: moodFromDb(row.mood),
      notes: row.notes,
      date: parseServerDate(row.date),
      time: row.time,
      weather: (row.weather as JournalEntry["weather"]) ?? null,
      photoUri,
      photoPath: row.photoPath ?? null,
      // undefined (et non null) quand la colonne manque : « inconnu », pas
      // « sans vidéo » (cf. agenda/store.tsx, fusion du journal).
      videoUri: row.videoPath === undefined ? undefined : row.videoPath ? (signedPhotos.get(row.videoPath) ?? null) : null,
      videoPath: row.videoPath === undefined ? undefined : row.videoPath,
      createdByUserId: row.createdByUserId,
    });
  }
  return entries;
}

/**
 * Séances d'entraînement planifiées manuellement : même logique de partage
 * que les rendez-vous/journal ci-dessus (scopées par horseId, RLS
 * can_access_horse) — contrairement à l'ancienne progression/programme IA
 * (jamais partagée, retirée avec la génération par IA), une séance planifiée
 * doit être visible par un demi-pensionnaire/coach.
 */
