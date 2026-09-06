import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase";
import type { RiderProfile } from "@/rider/store";
import type { Horse } from "@/horses/store";
import type { Appointment, CompetitionEntry, Doc, Expense, JournalEntry } from "@/agenda/store";
import type { TrainingSession } from "@/sessions/store";
import type { WeightMeasurement } from "@/horses/weightStore";

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

/** Durée de validité des URLs signées Storage (photos cheval/document/journal),
 * régénérées uniquement à la connexion (cf. login.tsx) — pas à chaque
 * ouverture d'écran. 90 jours plutôt que 7 : réduit nettement le risque
 * qu'une image casse pendant une session longue sans déconnexion, seule
 * mitigation possible sans changement d'architecture (cf. audit technique
 * post-V1 : une vraie correction demanderait de régénérer l'URL à la
 * demande à l'affichage plutôt qu'une fois pour toutes au login — hors
 * périmètre ici, pas de changement RLS/Storage nécessaire pour ce réglage).
 */
const SIGNED_URL_TTL_SECONDS = 90 * 24 * 60 * 60;

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
    primaryGoalCustom: rider.primaryGoalCustom,
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

/**
 * Photo de profil du cheval : même logique que le coffre-fort (upload à la
 * demande + URL signée régénérée au pull, cf. uploadDocumentPhoto/pullDocuments
 * plus bas), mais scoping par horseId (pas userId) — la photo doit rester
 * visible par un collaborateur (demi-pension/coach), cf. rls.sql
 * horse_photos_select_shared. Chemin déterministe "{horseId}/photo.jpg" (pas
 * un nom généré à chaque upload) : changer la photo remplace l'objet existant
 * (upsert) plutôt que d'en accumuler un nouveau à chaque édition.
 */
async function uploadHorsePhoto(horseId: string, localUri: string): Promise<string | null> {
  try {
    const bytes = await new File(localUri).bytes();
    const path = `${horseId}/photo.jpg`;
    const { error } = await supabase.storage.from("horse-photos").upload(path, bytes, {
      contentType: "image/jpeg",
      upsert: true,
    });
    return error ? null : path;
  } catch {
    return null;
  }
}

/** Best-effort : si l'objet ne se supprime pas, RLS empêche de toute façon
 * tout accès à qui que ce soit d'autre que le propriétaire/un collaborateur du
 * cheval déjà supprimé — pas une fuite. */
export async function deleteHorsePhotoRemote(horseId: string): Promise<void> {
  await supabase.storage.from("horse-photos").remove([`${horseId}/photo.jpg`]);
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

/** Photo de cheval dont le `photoPath` distant vient de changer (premier
 * upload ou suppression) — à reporter dans l'état local par l'appelant (cf.
 * horses/store.tsx `persist`), même principe que le `filePath` retourné par
 * `pushDocument`. Le chemin étant déterministe par cheval ("{horseId}/photo.jpg"),
 * remplacer une photo existante par une autre ne change PAS cette valeur (même
 * chemin, objet Storage écrasé) : seules les transitions "pas de photo → une
 * photo" et "une photo → supprimée" sont réellement à reporter localement. */
export async function pushHorses(horses: Horse[]): Promise<Array<{ id: string; photoPath: string | null }>> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const profile = await getOwnerProfile(userId);
  // Pas encore de rider_profile côté serveur (ex: confirmation email en
  // attente, cf. (onboarding)/account.tsx) : on retentera au prochain push,
  // pushRiderProfile() crée la ligne dès qu'une session existe.
  if (!profile) return [];

  const now = new Date().toISOString();
  const photoUpdates: Array<{ id: string; photoPath: string | null }> = [];
  // Un cheval à la fois, pas un upsert groupé : Postgres/RLS rejette un
  // upsert multi-lignes EN BLOC si UNE SEULE ligne viole le WITH CHECK (cf.
  // rls.sql horses_insert_own, quota du palier) — avec un upsert groupé, un
  // compte resté gratuit après avoir créé 2 chevaux en onboarding perdait
  // silencieusement les DEUX (pas juste le 2ᵉ en trop), cf. audit du
  // 2026-09-03. Séparé, seul le cheval en trop échoue ; les autres, dans la
  // limite, sont bien sauvegardés.
  for (const h of horses) {
    let photoPath = h.photoPath;
    if (h.photoUrl?.startsWith("file://")) {
      // Photo fraîchement choisie (jamais un chemin distant) : à uploader. En
      // cas d'échec réseau, on garde l'ancien photoPath — retenté au prochain
      // push plutôt que de perdre la référence existante.
      const uploaded = await uploadHorsePhoto(h.id, h.photoUrl);
      if (uploaded) photoPath = uploaded;
    } else if (h.photoUrl === null && h.photoPath) {
      await deleteHorsePhotoRemote(h.id);
      photoPath = null;
    }
    if (photoPath !== h.photoPath) photoUpdates.push({ id: h.id, photoPath });

    const { error } = await supabase.from("horses").upsert({
      id: h.id,
      ownerId: profile.id,
      name: h.name,
      photoPath,
      birthYear: h.birthYear,
      sex: h.sex,
      breed: h.breed,
      coat: h.coat,
      heightCm: h.heightCm,
      weightKg: h.weightKg,
      discipline: h.discipline,
      level: h.level,
      fitnessLevel: h.fitnessLevel,
      workload: h.workload,
      isPrimary: h.isPrimary,
      updatedAt: now,
    });
    if (error) console.warn("[cloudSync] upsert horse échoué", h.id, error);
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

  return photoUpdates;
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
    primaryGoalCustom: profile.primaryGoalCustom ?? null,
  };

  const remoteHorses = (profile.horses ?? []) as RemoteHorse[];
  const horses: Horse[] = await Promise.all(remoteHorses.map(mapRemoteHorse));

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
  | "photoUrl"
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
 * vrai rôle pour les chevaux partagés. `photoUrl` (affichable) est reconstruit
 * à partir de `photoPath` (chemin durable) via une URL signée, même principe
 * que `pullDocuments` — d'où l'`async`. */
export async function mapRemoteHorse(h: RemoteHorse): Promise<Horse> {
  let photoUrl: string | null = null;
  if (h.photoPath) {
    const { data: signed } = await supabase.storage
      .from("horse-photos")
      .createSignedUrl(h.photoPath, SIGNED_URL_TTL_SECONDS);
    photoUrl = signed?.signedUrl ?? null;
  }
  return {
    ...h,
    photoUrl,
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

/** Upload la photo (si locale) puis upsert la ligne. Retourne le `filePath`
 * résultant — à reporter dans l'état local par l'appelant (cf. agenda/store.tsx
 * addDocument/updateDocument) pour ne pas re-uploader la même photo à chaque
 * synchro suivante. Retourne null sans rien casser si la synchro échoue (pas
 * de session, pas de profil serveur encore, erreur réseau).
 *
 * `doc.fileUri` ne vaut "file://…" QUE pour une photo locale pas encore
 * envoyée (une photo déjà synchronisée redevient une URL signée "https://…"
 * au prochain pull, cf. pullDocuments) : c'est un signal fiable de "photo à
 * (ré)uploader", qu'il s'agisse du tout premier envoi ou du remplacement
 * d'une photo existante lors d'une édition (cf. updateDocument) — le chemin
 * "{userId}/{docId}.jpg" est déterministe par document, un nouvel upload
 * écrase donc simplement l'ancien objet (upsert), même logique que les photos
 * de cheval (cf. uploadHorsePhoto plus haut). */
export async function pushDocument(doc: Doc): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const profile = await getOwnerProfile(userId);
  if (!profile) return null;

  let filePath = doc.filePath;
  if (doc.fileUri?.startsWith("file://")) {
    const uploaded = await uploadDocumentPhoto(userId, doc.id, doc.fileUri);
    if (uploaded) filePath = uploaded;
  }

  const { error } = await supabase.from("documents").upsert({
    id: doc.id,
    riderId: profile.id,
    horseId: doc.horseId,
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
    .select("id, horseId, category, name, date, filePath")
    .eq("riderId", profile.id);
  if (error || !data) return [];

  const docs: Doc[] = [];
  for (const row of data) {
    let fileUri: string | null = null;
    if (row.filePath) {
      const { data: signed } = await supabase.storage
        .from("documents")
        .createSignedUrl(row.filePath, SIGNED_URL_TTL_SECONDS);
      fileUri = signed?.signedUrl ?? null;
    }
    docs.push({
      id: row.id,
      horseId: row.horseId ?? null,
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
    dossard: appt.dossard,
    professional: appt.professional,
    cost: appt.cost,
    nextDueDate: appt.nextDueDate?.toISOString() ?? null,
    updatedAt: new Date().toISOString(),
  });
  if (error) console.warn("[cloudSync] pushAppointment échoué", error);
}

export async function deleteAppointmentRemote(apptId: string): Promise<void> {
  const { error } = await supabase.from("appointments").delete().eq("id", apptId);
  if (error) console.warn("[cloudSync] deleteAppointmentRemote échoué", error);
}

/** Restaure les rendez-vous visibles par l'utilisateur courant — possédés ET
 * partagés (cf. ci-dessus, géré entièrement par RLS). Les épreuves sont
 * restaurées via la jointure imbriquée `competition_entries(*)` (même
 * technique que `pullCloudData` pour horse_traits/horse_injuries), pas un
 * appel séparé. */
export async function pullAppointments(): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, horseId, type, title, date, time, location, notes, reminder, result, checklist, dossard, professional, cost, nextDueDate, competition_entries(id, name, discipline, time, result)"
    );
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
    nextDueNotificationId: null,
    result: row.result ?? null,
    checklist: (row.checklist as Appointment["checklist"]) ?? [],
    dossard: row.dossard ?? null,
    professional: row.professional ?? null,
    cost: row.cost === null || row.cost === undefined ? null : Number(row.cost),
    nextDueDate: row.nextDueDate ? new Date(row.nextDueDate) : null,
    competitionEntries: ((row.competition_entries ?? []) as RemoteCompetitionEntry[]).map((e) => ({
      id: e.id,
      name: e.name,
      discipline: e.discipline as CompetitionEntry["discipline"],
      time: e.time,
      result: e.result ?? null,
    })),
  }));
}

type RemoteCompetitionEntry = { id: string; name: string; discipline: string; time: string; result: string | null };

/** Une épreuve à la fois (upsert) — même logique que les documents (cf.
 * pushDocument) : pas d'opération de remplacement en masse, le volume par
 * rendez-vous reste faible. */
export async function pushCompetitionEntry(appointmentId: string, entry: CompetitionEntry): Promise<void> {
  const { error } = await supabase.from("competition_entries").upsert({
    id: entry.id,
    appointmentId,
    name: entry.name,
    discipline: entry.discipline,
    time: entry.time,
    result: entry.result,
    updatedAt: new Date().toISOString(),
  });
  if (error) console.warn("[cloudSync] pushCompetitionEntry échoué", error);
}

export async function deleteCompetitionEntryRemote(entryId: string): Promise<void> {
  const { error } = await supabase.from("competition_entries").delete().eq("id", entryId);
  if (error) console.warn("[cloudSync] deleteCompetitionEntryRemote échoué", error);
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

/** Upload la photo (si locale) puis upsert la ligne — même logique que
 * pushDocument : retourne le `photoPath` résultant, à reporter localement par
 * l'appelant (cf. agenda/store.tsx addJournalEntry/updateJournalEntry) pour ne
 * pas re-uploader la même photo à la prochaine synchro. `entry.photoUri` ne
 * vaut "file://…" QUE pour une photo locale pas encore envoyée (premier envoi
 * ou remplacement lors d'une édition, cf. updateJournalEntry). */
export async function pushJournalEntry(entry: JournalEntry): Promise<string | null> {
  if (!entry.horseId) return null;

  let photoPath = entry.photoPath;
  if (entry.photoUri?.startsWith("file://")) {
    const uploaded = await uploadJournalPhoto(entry.horseId, entry.id, entry.photoUri);
    if (uploaded) photoPath = uploaded;
  }

  const { error } = await supabase.from("journal_entries").upsert({
    id: entry.id,
    horseId: entry.horseId,
    activityType: activityTypeToDb(entry.activityType),
    mood: moodToDb(entry.mood),
    notes: entry.notes,
    date: entry.date.toISOString(),
    time: entry.time,
    weather: entry.weather,
    photoPath,
    updatedAt: new Date().toISOString(),
  });
  if (error) {
    console.warn("[cloudSync] pushJournalEntry échoué", error);
    return null;
  }
  return photoPath;
}

/** `horseId` nécessaire pour supprimer aussi la photo distante (cf. ci-dessus,
 * chemin scopé par cheval) — best-effort comme deleteDocumentRemote : si
 * l'objet Storage ne se supprime pas, RLS empêche de toute façon tout accès
 * par un autre utilisateur que le propriétaire/un collaborateur du cheval
 * déjà supprimé, pas une fuite. */
export async function deleteJournalEntryRemote(entryId: string, horseId: string | null): Promise<void> {
  const { error } = await supabase.from("journal_entries").delete().eq("id", entryId);
  if (error) console.warn("[cloudSync] deleteJournalEntryRemote échoué", error);
  if (horseId) {
    await supabase.storage.from("horse-photos").remove([`${horseId}/journal/${entryId}.jpg`]);
  }
}

export async function pullJournalEntries(): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, horseId, activityType, mood, notes, date, time, weather, photoPath");
  if (error || !data) return [];
  const entries: JournalEntry[] = [];
  for (const row of data) {
    let photoUri: string | null = null;
    if (row.photoPath) {
      const { data: signed } = await supabase.storage
        .from("horse-photos")
        .createSignedUrl(row.photoPath, SIGNED_URL_TTL_SECONDS);
      photoUri = signed?.signedUrl ?? null;
    }
    entries.push({
      id: row.id,
      horseId: row.horseId,
      activityType: activityTypeFromDb(row.activityType),
      mood: moodFromDb(row.mood),
      notes: row.notes,
      date: new Date(row.date),
      time: row.time,
      weather: (row.weather as JournalEntry["weather"]) ?? null,
      photoUri,
      photoPath: row.photoPath ?? null,
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

export async function pushTrainingSession(session: TrainingSession): Promise<void> {
  if (!session.horseId) return;
  const { error } = await supabase.from("training_sessions").upsert({
    id: session.id,
    horseId: session.horseId,
    activityType: session.activityType.toUpperCase(),
    customActivityLabel: session.customActivityLabel,
    date: session.date.toISOString(),
    time: session.time,
    durationMinutes: session.durationMinutes,
    intensity: session.intensity,
    notes: session.notes,
    completed: session.completed,
    updatedAt: new Date().toISOString(),
  });
  if (error) console.warn("[cloudSync] pushTrainingSession échoué", error);
}

export async function deleteTrainingSessionRemote(sessionId: string): Promise<void> {
  const { error } = await supabase.from("training_sessions").delete().eq("id", sessionId);
  if (error) console.warn("[cloudSync] deleteTrainingSessionRemote échoué", error);
}

/** Restaure les séances visibles par l'utilisateur courant — possédées ET
 * partagées (géré entièrement par RLS, cf. pullAppointments ci-dessus). */
export async function pullTrainingSessions(): Promise<TrainingSession[]> {
  const { data, error } = await supabase
    .from("training_sessions")
    .select("id, horseId, activityType, customActivityLabel, date, time, durationMinutes, intensity, notes, completed");
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    horseId: row.horseId,
    activityType: (row.activityType as string).toLowerCase() as TrainingSession["activityType"],
    customActivityLabel: row.customActivityLabel ?? null,
    date: new Date(row.date),
    time: row.time,
    durationMinutes: row.durationMinutes ?? null,
    intensity: (row.intensity as TrainingSession["intensity"]) ?? null,
    notes: row.notes,
    completed: row.completed,
  }));
}

/**
 * Suivi de poids : même portée de partage que training_sessions ci-dessus
 * (horseId, RLS can_access_horse) — audit produit post-V1, cf.
 * horses/weightStore.tsx.
 */

export async function pushWeightMeasurement(measurement: WeightMeasurement): Promise<void> {
  const { error } = await supabase.from("horse_weight_measurements").upsert({
    id: measurement.id,
    horseId: measurement.horseId,
    weightKg: measurement.weightKg,
    date: measurement.date.toISOString(),
    updatedAt: new Date().toISOString(),
  });
  if (error) console.warn("[cloudSync] pushWeightMeasurement échoué", error);
}

export async function deleteWeightMeasurementRemote(id: string): Promise<void> {
  const { error } = await supabase.from("horse_weight_measurements").delete().eq("id", id);
  if (error) console.warn("[cloudSync] deleteWeightMeasurementRemote échoué", error);
}

export async function pullWeightMeasurements(): Promise<WeightMeasurement[]> {
  const { data, error } = await supabase.from("horse_weight_measurements").select("id, horseId, weightKg, date");
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    horseId: row.horseId,
    weightKg: row.weightKg,
    date: new Date(row.date),
  }));
}

/**
 * Dépenses : même portée de partage que training_sessions ci-dessus
 * (horseId, RLS can_access_horse) — synchronisées une à une comme les
 * documents/épreuves (cf. pushDocument/pushCompetitionEntry), pas de
 * remplacement en masse.
 */

function expenseCategoryToDb(category: Expense["category"]): string {
  return category.toUpperCase();
}

function expenseCategoryFromDb(category: string): Expense["category"] {
  return category.toLowerCase() as Expense["category"];
}

export async function pushExpense(expense: Expense): Promise<void> {
  if (!expense.horseId) return;
  const { error } = await supabase.from("expenses").upsert({
    id: expense.id,
    horseId: expense.horseId,
    amount: expense.amount,
    currency: expense.currency,
    category: expenseCategoryToDb(expense.category),
    date: expense.date.toISOString(),
    notes: expense.notes,
    appointmentId: expense.appointmentId,
    documentId: expense.documentId,
    isPaid: expense.isPaid,
    updatedAt: new Date().toISOString(),
  });
  if (error) console.warn("[cloudSync] pushExpense échoué", error);
}

export async function deleteExpenseRemote(expenseId: string): Promise<void> {
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
  if (error) console.warn("[cloudSync] deleteExpenseRemote échoué", error);
}

/** Restaure les dépenses visibles par l'utilisateur courant — possédées ET
 * partagées (géré entièrement par RLS, cf. pullAppointments ci-dessus). Le
 * lien vers un document (reçu) n'est PAS résolu ici en jointure imbriquée :
 * un collaborateur consultant une dépense partagée dont le reçu appartient
 * au propriétaire (RLS `documents` = owns_rider_profile, jamais partagée) ne
 * l'aura de toute façon jamais dans son propre `pullDocuments()` — l'écran
 * (cf. agenda.tsx) affiche "reçu non disponible" en croisant localement
 * `documentId` avec la liste de documents déjà chargée par l'utilisateur
 * courant, sans appel réseau supplémentaire ni fuite. */
export async function pullExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("id, horseId, amount, currency, category, date, notes, appointmentId, documentId, isPaid");
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    horseId: row.horseId,
    amount: Number(row.amount),
    currency: row.currency,
    category: expenseCategoryFromDb(row.category),
    date: new Date(row.date),
    notes: row.notes,
    appointmentId: row.appointmentId ?? null,
    documentId: row.documentId ?? null,
    isPaid: row.isPaid ?? false,
  }));
}
