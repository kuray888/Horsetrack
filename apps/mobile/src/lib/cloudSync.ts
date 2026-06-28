import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase";
import type { RiderProfile } from "@/rider/store";
import type { Horse } from "@/horses/store";
import type { Appointment, Doc, JournalEntry } from "@/agenda/store";
import type { GeneratedProgram } from "@/program/types";

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

function generateId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

async function getOwnerProfile(userId: string): Promise<{ id: string; onboardingCompletedAt: string | null } | null> {
  const { data } = await supabase
    .from("rider_profiles")
    .select("id, onboardingCompletedAt")
    .eq("userId", userId)
    .maybeSingle();
  return data ?? null;
}

export async function pushRiderProfile(rider: RiderProfile): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  const now = new Date().toISOString();
  const existing = await getOwnerProfile(userId);
  const fields = {
    level: rider.level,
    mainDiscipline: rider.mainDiscipline,
    rideFrequency: rider.rideFrequency,
    primaryGoal: rider.primaryGoal,
    additionalInfo: rider.additionalInfo.trim() || null,
    // Ne se pose qu'une fois — sert de signal "ce compte a déjà un profil
    // complet côté serveur" pour pullCloudData(), pas d'horodatage d'édition.
    onboardingCompletedAt: existing?.onboardingCompletedAt ?? now,
    updatedAt: now,
  };

  const { error } = existing
    ? await supabase.from("rider_profiles").update(fields).eq("id", existing.id)
    : await supabase.from("rider_profiles").insert({ id: generateId(), userId, ...fields });
  if (error) console.warn("[cloudSync] pushRiderProfile échoué", error);
}

async function pushHorseTraitsAndInjuries(horse: Horse): Promise<void> {
  const traitRows = [
    ...horse.strengths.map((tag) => ({ id: generateId(), horseId: horse.id, tag, kind: "STRENGTH" })),
    ...horse.weaknesses.map((tag) => ({ id: generateId(), horseId: horse.id, tag, kind: "WEAKNESS" })),
    ...horse.temperament.map((tag) => ({ id: generateId(), horseId: horse.id, tag, kind: "TEMPERAMENT" })),
    ...horse.healthConditions.map((tag) => ({ id: generateId(), horseId: horse.id, tag, kind: "HEALTH_CONDITION" })),
  ];
  // Pas d'id de tag stable côté local : on remplace tout plutôt que de tenter
  // un diff précis, le volume par cheval est trop faible pour que ça coûte.
  const { error: deleteTraitsError } = await supabase.from("horse_traits").delete().eq("horseId", horse.id);
  if (deleteTraitsError) console.warn("[cloudSync] suppression horse_traits échouée", deleteTraitsError);
  if (traitRows.length > 0) {
    const { error } = await supabase.from("horse_traits").insert(traitRows);
    if (error) console.warn("[cloudSync] insertion horse_traits échouée", error);
  }

  const now = new Date().toISOString();
  // recoveryStatus est NOT NULL côté DB ; le type local l'autorise à null tant
  // qu'une blessure est en cours de saisie (cf. InjuryHistoryField), mais le
  // formulaire bloque l'ajout avant qu'il soit renseigné — filtre défensif.
  const injuries = horse.injuries.filter((i) => i.recoveryStatus !== null);
  if (injuries.length > 0) {
    const { error } = await supabase.from("horse_injuries").upsert(
      injuries.map((i) => ({
        id: i.id,
        horseId: horse.id,
        type: i.type,
        occurredAt: i.occurredAt?.toISOString() ?? null,
        recoveryStatus: i.recoveryStatus,
        note: i.note.trim() || null,
        updatedAt: now,
      }))
    );
    if (error) console.warn("[cloudSync] upsert horse_injuries échoué", error);
  }
  const { data: remoteInjuries, error: selectInjuriesError } = await supabase
    .from("horse_injuries")
    .select("id")
    .eq("horseId", horse.id);
  if (selectInjuriesError) console.warn("[cloudSync] lecture horse_injuries échouée", selectInjuriesError);
  const injuryIds = injuries.map((i) => i.id);
  const staleInjuryIds = (remoteInjuries ?? []).map((r) => r.id).filter((id) => !injuryIds.includes(id));
  if (staleInjuryIds.length > 0) {
    const { error } = await supabase.from("horse_injuries").delete().in("id", staleInjuryIds);
    if (error) console.warn("[cloudSync] suppression horse_injuries obsolètes échouée", error);
  }
}

export async function pushHorses(horses: Horse[]): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  const profile = await getOwnerProfile(userId);
  // Pas encore de rider_profile côté serveur (ex: confirmation email en
  // attente, cf. (onboarding)/account.tsx) : on retentera au prochain push,
  // pushRiderProfile() crée la ligne dès qu'une session existe.
  if (!profile) return;

  const now = new Date().toISOString();
  if (horses.length > 0) {
    const { error } = await supabase.from("horses").upsert(
      horses.map((h) => ({
        id: h.id,
        ownerId: profile.id,
        name: h.name,
        photoUrl: h.photoUrl,
        birthYear: h.birthYear,
        sex: h.sex,
        breed: h.breed,
        heightCm: h.heightCm,
        weightKg: h.weightKg,
        discipline: h.discipline,
        level: h.level,
        fitnessLevel: h.fitnessLevel,
        workload: h.workload,
        isPrimary: h.isPrimary,
        updatedAt: now,
      }))
    );
    if (error) console.warn("[cloudSync] upsert horses échoué", error);
  }

  // Supprime côté distant les chevaux qui n'existent plus localement — pas de
  // suppression de cheval dans l'UI actuelle, mais garde la sync correcte le
  // jour où elle arrive plutôt que de laisser des chevaux fantômes.
  const { data: remoteHorses, error: selectHorsesError } = await supabase
    .from("horses")
    .select("id")
    .eq("ownerId", profile.id);
  if (selectHorsesError) console.warn("[cloudSync] lecture horses échouée", selectHorsesError);
  const localIds = horses.map((h) => h.id);
  const staleHorseIds = (remoteHorses ?? []).map((r) => r.id).filter((id) => !localIds.includes(id));
  if (staleHorseIds.length > 0) {
    const { error } = await supabase.from("horses").delete().in("id", staleHorseIds);
    if (error) console.warn("[cloudSync] suppression horses obsolètes échouée", error);
  }

  for (const horse of horses) {
    await pushHorseTraitsAndInjuries(horse);
  }
}

type CloudData = { rider: RiderProfile; horses: Horse[] };

/**
 * Restaure écurie + profil cavalier depuis Supabase — appelé uniquement
 * quand cet appareil n'a pas (ou plus) les données locales du compte qui
 * vient de se connecter (cf. (auth)/login.tsx). Renvoie null si ce compte n'a
 * jamais terminé l'onboarding côté serveur (rien à restaurer).
 */
export async function pullCloudData(): Promise<CloudData | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data: profile, error } = await supabase
    .from("rider_profiles")
    .select("*, horses(*, horse_traits(*), horse_injuries(*))")
    .eq("userId", userId)
    .maybeSingle();

  // Une erreur réseau/serveur ne doit JAMAIS être interprétée comme "ce compte
  // n'a pas de données" (cf. (auth)/login.tsx, qui sinon repartirait d'un
  // état vide puis supprimerait les vraies données distantes au prochain push
  // — cf. pushHorses ci-dessous, qui efface côté serveur tout cheval absent
  // du local).
  if (error) throw error;
  if (!profile || !profile.onboardingCompletedAt) return null;

  const rider: RiderProfile = {
    level: profile.level,
    mainDiscipline: profile.mainDiscipline,
    rideFrequency: profile.rideFrequency,
    primaryGoal: profile.primaryGoal,
    additionalInfo: profile.additionalInfo ?? "",
  };

  const remoteHorses = (profile.horses ?? []) as RemoteHorse[];
  const horses: Horse[] = remoteHorses.map(mapRemoteHorse);

  return { rider, horses };
}

export type RemoteTrait = { tag: string; kind: string };
export type RemoteInjury = {
  id: string;
  type: string;
  occurredAt: string | null;
  recoveryStatus: Horse["injuries"][number]["recoveryStatus"];
  note: string | null;
};
export type RemoteHorse = Omit<
  Horse,
  | "emoji"
  | "strengths"
  | "weaknesses"
  | "temperament"
  | "healthConditions"
  | "restDayActivities"
  | "injuries"
  | "sharedRole"
> & {
  horse_traits: RemoteTrait[];
  horse_injuries: RemoteInjury[];
};

/** Convertit la forme "brute" renvoyée par une requête Supabase imbriquée
 * (horses(*, horse_traits(*), horse_injuries(*))) en `Horse` local — partagée
 * entre `pullCloudData` (chevaux possédés) et `lib/sharing.ts` `pullSharedHorses`
 * (chevaux partagés), mêmes colonnes distantes des deux côtés. `sharedRole`
 * n'existe pas comme colonne réelle (c'est une notion purement locale) : on le
 * met à `null` par défaut ici, `pullSharedHorses` l'écrase ensuite avec le
 * vrai rôle pour les chevaux partagés. */
export function mapRemoteHorse(h: RemoteHorse): Horse {
  return {
    ...h,
    emoji: "🐴",
    sharedRole: null,
    strengths: h.horse_traits.filter((t) => t.kind === "STRENGTH").map((t) => t.tag),
    weaknesses: h.horse_traits.filter((t) => t.kind === "WEAKNESS").map((t) => t.tag),
    temperament: h.horse_traits.filter((t) => t.kind === "TEMPERAMENT").map((t) => t.tag),
    healthConditions: h.horse_traits.filter((t) => t.kind === "HEALTH_CONDITION").map((t) => t.tag),
    // Pas encore synchronisé côté serveur (cf. décision lors de son ajout) —
    // l'utilisateur devra le ressaisir une fois après une restauration.
    restDayActivities: [],
    injuries: h.horse_injuries.map((i) => ({
      id: i.id,
      type: i.type,
      occurredAt: i.occurredAt ? new Date(i.occurredAt) : null,
      recoveryStatus: i.recoveryStatus,
      note: i.note ?? "",
    })),
  };
}

/**
 * Coffre-fort numérique : contrairement à l'écurie/le profil cavalier
 * (synchronisés en repoussant l'état complet à chaque mutation, cf. ci-dessus),
 * les documents sont synchronisés un par un — un document n'a pas d'opération
 * de remplacement en masse comme `replaceHorses`, et repousser la photo de
 * TOUS les documents à chaque ajout/suppression serait un gaspillage de bande
 * passante qui grossirait avec la taille du coffre-fort.
 */

function categoryToDb(category: Doc["category"]): string {
  return category.toUpperCase();
}

function categoryFromDb(category: string): Doc["category"] {
  return category.toLowerCase() as Doc["category"];
}

async function uploadDocumentPhoto(userId: string, docId: string, localUri: string): Promise<string | null> {
  try {
    const bytes = await new File(localUri).bytes();
    const path = `${userId}/${docId}.jpg`;
    const { error } = await supabase.storage.from("documents").upload(path, bytes, {
      contentType: "image/jpeg",
      upsert: true,
    });
    return error ? null : path;
  } catch {
    return null;
  }
}

/** Upload la photo (si locale et pas encore envoyée) puis upsert la ligne.
 * Retourne le `filePath` résultant — à reporter dans l'état local par
 * l'appelant (cf. agenda/store.tsx `addDocument`) pour ne pas re-uploader la
 * même photo à chaque synchro suivante. Retourne null sans rien casser si la
 * synchro échoue (pas de session, pas de profil serveur encore, erreur réseau). */
export async function pushDocument(doc: Doc): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const profile = await getOwnerProfile(userId);
  if (!profile) return null;

  let filePath = doc.filePath;
  if (doc.fileUri?.startsWith("file://") && !filePath) {
    filePath = await uploadDocumentPhoto(userId, doc.id, doc.fileUri);
  }

  const { error } = await supabase.from("documents").upsert({
    id: doc.id,
    riderId: profile.id,
    category: categoryToDb(doc.category),
    name: doc.name,
    date: doc.date.toISOString(),
    filePath,
    updatedAt: new Date().toISOString(),
  });
  return error ? null : filePath;
}

export async function deleteDocumentRemote(docId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;
  await supabase.from("documents").delete().eq("id", docId);
  // Best-effort : si l'objet Storage ne se supprime pas, RLS empêche de
  // toute façon tout accès par un autre utilisateur — pas une fuite.
  await supabase.storage.from("documents").remove([`${userId}/${docId}.jpg`]);
}

/** Restaure le coffre-fort depuis Supabase (cf. (auth)/login.tsx, même
 * déclencheur que pullCloudData). Les URLs étant signées (bucket privé,
 * validité 7 jours), elles sont régénérées à chaque appel — donc à chaque
 * connexion sur un appareil qui n'a pas déjà les données locales. */
export async function pullDocuments(): Promise<Doc[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const profile = await getOwnerProfile(userId);
  if (!profile) return [];

  const { data, error } = await supabase
    .from("documents")
    .select("id, category, name, date, filePath")
    .eq("riderId", profile.id);
  if (error || !data) return [];

  const docs: Doc[] = [];
  for (const row of data) {
    let fileUri: string | null = null;
    if (row.filePath) {
      const { data: signed } = await supabase.storage
        .from("documents")
        .createSignedUrl(row.filePath, 7 * 24 * 60 * 60);
      fileUri = signed?.signedUrl ?? null;
    }
    docs.push({
      id: row.id,
      category: categoryFromDb(row.category),
      name: row.name,
      date: new Date(row.date),
      fileUri,
      filePath: row.filePath ?? null,
    });
  }
  return docs;
}

/**
 * Calendrier (rendez-vous + journal) : contrairement au coffre-fort, ces
 * tables sont scopées par horseId — pas par riderId — donc aucune jointure
 * via rider_profiles n'est nécessaire ici. La policy RLS `can_access_horse`
 * filtre déjà automatiquement aux chevaux possédés OU partagés avec
 * l'utilisateur courant (cf. partage demi-pension/coach), en lecture comme
 * en écriture : ces fonctions n'ont donc rien de spécial à faire pour gérer
 * le cas "cheval partagé", RLS s'en occupe.
 */

function appointmentTypeToDb(type: Appointment["type"]): string {
  return type.toUpperCase();
}

function appointmentTypeFromDb(type: string): Appointment["type"] {
  return type.toLowerCase() as Appointment["type"];
}

/** Pas de push si l'entrée n'est pas encore rattachée à un cheval (cf.
 * agenda/store.tsx, backfill au chargement) — rien à synchroniser tant
 * qu'aucun horseId n'est connu. */
export async function pushAppointment(appt: Appointment): Promise<void> {
  if (!appt.horseId) return;
  const { error } = await supabase.from("appointments").upsert({
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
    updatedAt: new Date().toISOString(),
  });
  if (error) console.warn("[cloudSync] pushAppointment échoué", error);
}

export async function deleteAppointmentRemote(apptId: string): Promise<void> {
  const { error } = await supabase.from("appointments").delete().eq("id", apptId);
  if (error) console.warn("[cloudSync] deleteAppointmentRemote échoué", error);
}

/** Restaure les rendez-vous visibles par l'utilisateur courant — possédés ET
 * partagés (cf. ci-dessus, géré entièrement par RLS). */
export async function pullAppointments(): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("id, horseId, type, title, date, time, location, notes, reminder, result, checklist");
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    horseId: row.horseId,
    type: appointmentTypeFromDb(row.type),
    title: row.title,
    date: new Date(row.date),
    time: row.time,
    location: row.location,
    notes: row.notes,
    reminder: row.reminder as Appointment["reminder"],
    // Jamais synchronisés (cf. schema.prisma Appointment) : identifiants de
    // planification propres à l'appareil/au compte qui a créé le rappel.
    reminderNotificationId: null,
    emailReminderId: null,
    result: row.result ?? null,
    checklist: (row.checklist as Appointment["checklist"]) ?? [],
  }));
}

function activityTypeToDb(type: JournalEntry["activityType"]): string {
  return type.toUpperCase();
}

function activityTypeFromDb(type: string): JournalEntry["activityType"] {
  return type.toLowerCase() as JournalEntry["activityType"];
}

function moodToDb(mood: JournalEntry["mood"]): string {
  return mood.toUpperCase();
}

function moodFromDb(mood: string): JournalEntry["mood"] {
  return mood.toLowerCase() as JournalEntry["mood"];
}

export async function pushJournalEntry(entry: JournalEntry): Promise<void> {
  if (!entry.horseId) return;
  const { error } = await supabase.from("journal_entries").upsert({
    id: entry.id,
    horseId: entry.horseId,
    activityType: activityTypeToDb(entry.activityType),
    mood: moodToDb(entry.mood),
    notes: entry.notes,
    date: entry.date.toISOString(),
    time: entry.time,
    weather: entry.weather,
    updatedAt: new Date().toISOString(),
  });
  if (error) console.warn("[cloudSync] pushJournalEntry échoué", error);
}

export async function deleteJournalEntryRemote(entryId: string): Promise<void> {
  const { error } = await supabase.from("journal_entries").delete().eq("id", entryId);
  if (error) console.warn("[cloudSync] deleteJournalEntryRemote échoué", error);
}

export async function pullJournalEntries(): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, horseId, activityType, mood, notes, date, time, weather");
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    horseId: row.horseId,
    activityType: activityTypeFromDb(row.activityType),
    mood: moodFromDb(row.mood),
    notes: row.notes,
    date: new Date(row.date),
    time: row.time,
    weather: (row.weather as JournalEntry["weather"]) ?? null,
  }));
}

/**
 * Progression d'entraînement et programme généré : contrairement à
 * l'écurie/au profil cavalier, ce sont des données purement personnelles au
 * cavalier propriétaire (pas partagées avec un demi-pensionnaire/coach, cf.
 * rls.sql) — un seul upsert par cheval (1-1), pas de push en masse ni de
 * suppression de lignes obsolètes comme pushHorses. `pullAll*` n'a pas
 * besoin d'argument horseId : RLS (`owns_horse`) limite déjà le résultat aux
 * propres chevaux de l'utilisateur courant, comme pullAppointments ci-dessus.
 */

export type RemoteProgress = {
  completed: Record<string, boolean>;
  bestWeekStreak: number;
  debriefs: Record<string, { mood: string; note: string }>;
  programGeneratedAt: string | null;
};

/** `id`/`updatedAt` n'ont pas de vrai DEFAULT SQL (`@default(cuid())`/
 * `@updatedAt` sont des conventions du client Prisma, jamais utilisé ici —
 * cf. lib/sharing.ts) : un upsert direct sans fournir `id` échoue toujours
 * (NOT NULL), donc on suit le même pattern que pushRiderProfile — lire la
 * ligne existante par la clé naturelle (`horseId`), update en gardant son id
 * si elle existe, insert avec un nouvel id sinon. */
export async function pushHorseProgress(horseId: string, data: RemoteProgress): Promise<void> {
  const { data: existing } = await supabase.from("horse_progress").select("id").eq("horseId", horseId).maybeSingle();
  const fields = {
    completed: data.completed,
    bestWeekStreak: data.bestWeekStreak,
    debriefs: data.debriefs,
    programGeneratedAt: data.programGeneratedAt,
    updatedAt: new Date().toISOString(),
  };
  const { error } = existing
    ? await supabase.from("horse_progress").update(fields).eq("id", existing.id)
    : await supabase.from("horse_progress").insert({ id: generateId(), horseId, ...fields });
  if (error) console.warn("[cloudSync] pushHorseProgress échoué", error);
}

export async function pullAllHorseProgress(): Promise<Record<string, RemoteProgress>> {
  const { data, error } = await supabase
    .from("horse_progress")
    .select("horseId, completed, bestWeekStreak, debriefs, programGeneratedAt");
  if (error || !data) return {};
  const result: Record<string, RemoteProgress> = {};
  for (const row of data) {
    result[row.horseId] = {
      completed: (row.completed as Record<string, boolean>) ?? {},
      bestWeekStreak: row.bestWeekStreak ?? 0,
      debriefs: (row.debriefs as Record<string, { mood: string; note: string }>) ?? {},
      programGeneratedAt: row.programGeneratedAt ?? null,
    };
  }
  return result;
}

export type RemoteProgramData = { program: GeneratedProgram; signature: string; bilanDismissedAt: string | null };

/** Même raison/pattern que pushHorseProgress ci-dessus. */
export async function pushHorseProgram(horseId: string, data: RemoteProgramData): Promise<void> {
  const { data: existing } = await supabase.from("horse_programs").select("id").eq("horseId", horseId).maybeSingle();
  const fields = {
    program: data.program,
    signature: data.signature,
    bilanDismissedAt: data.bilanDismissedAt,
    updatedAt: new Date().toISOString(),
  };
  const { error } = existing
    ? await supabase.from("horse_programs").update(fields).eq("id", existing.id)
    : await supabase.from("horse_programs").insert({ id: generateId(), horseId, ...fields });
  if (error) console.warn("[cloudSync] pushHorseProgram échoué", error);
}

export async function pullAllHorsePrograms(): Promise<Record<string, RemoteProgramData>> {
  const { data, error } = await supabase.from("horse_programs").select("horseId, program, signature, bilanDismissedAt");
  if (error || !data) return {};
  const result: Record<string, RemoteProgramData> = {};
  for (const row of data) {
    result[row.horseId] = {
      program: row.program as GeneratedProgram,
      signature: row.signature,
      bilanDismissedAt: row.bilanDismissedAt ?? null,
    };
  }
  return result;
}
