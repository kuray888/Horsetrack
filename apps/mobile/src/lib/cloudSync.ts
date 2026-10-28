import { File } from "expo-file-system";
import {
  discardSupersededWrites,
  enqueueFailedWrite,
  flushSyncQueue,
  isStillQueued,
  operationStartedAt,
  pendingIdsFor,
  type SyncOperation,
} from "@/lib/syncQueue";
import { supabase } from "@/lib/supabase";
import {
  beginWrite,
  confirmWrite,
  endWrite,
  hasNewerWrite,
  loadRemoteIndex,
  recordWriteSuccess,
  serializeWrite,
  unconfirmedDeletes,
  withWriteTracking,
} from "@/lib/remoteIndex";
import { clearRejectedWrite } from "@/lib/rejectedWrites";
import { parseServerDate, parseServerDateOrNull } from "@/lib/serverDate";
import type { RiderProfile } from "@/rider/store";
import type { Horse } from "@/horses/store";
import type { Appointment, CompetitionEntry, Doc, Expense, JournalEntry } from "@/agenda/store";
import type { TrainingSession } from "@/sessions/store";
import type { SessionRide } from "@/rides/types";
import { activityFromServer, activityToServer } from "@/agenda/activityKinds";
import type { Contact, HorseDetails } from "@/extras/model";
import { noteColumnsRead } from "@/lib/schemaGaps";
import { hasUnsentJournalMedia } from "@/agenda/journalMedia";
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

/** Signe plusieurs chemins d'un bucket en une requête par lot de 100 (au lieu
 * d'une requête par fichier) — les relectures régulières (cf.
 * lib/cloudRefresh.ts) resignent tout le coffre-fort et le journal. Chemin
 * absent de la réponse = pas d'URL (fichier supprimé, erreur). */
async function signPaths(bucket: string, paths: string[]): Promise<Map<string, string>> {
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

function generateId(): string {
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

async function settleWrite(
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

/**
 * Supprime UN cheval côté serveur (suppression explicite demandée par
 * l'utilisateur, cf. horses/store.tsx removeHorse). La cascade Postgres
 * emporte ses rendez-vous, séances, journal, dépenses ; le stockage n'ayant
 * pas de cascade, sa photo et ses photos de journal sont supprimées ici
 * (best-effort). En cas d'échec réseau, la suppression de la ligne passe par
 * la file de reprise (cf. settleWrite) plutôt que d'être perdue.
 */
async function deleteHorseRemoteImpl(horseId: string, stamp?: number): Promise<void> {
  try {
    const { data: journalFiles } = await supabase.storage.from("horse-photos").list(`${horseId}/journal`, { limit: 1000 });
    const paths = [`${horseId}/photo.jpg`, ...(journalFiles ?? []).map((f) => `${horseId}/journal/${f.name}`)];
    await supabase.storage.from("horse-photos").remove(paths);
  } catch {
    // best-effort : cf. commentaire de deleteHorsePhotoRemote
  }
  const { error } = await supabase.from("horses").delete().eq("id", horseId);
  await settleWrite("deleteHorseRemote", "horses", horseId, error, undefined, stamp);
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
 * photo" et "une photo → supprimée" sont réellement à reporter localement.
 *
 * `rejectedIds` : chevaux dont l'insert a été refusé par le trigger
 * `enforce_horse_quota` (quota du palier gratuit dépassé, cf. rls.sql) — cf.
 * audit du 2026-09-16, un compte resté sur ce palier après avoir créé un 2ᵉ
 * cheval le gardait indéfiniment en local bien qu'il n'ait jamais existé côté
 * serveur, faisant échouer en boucle silencieuse toute écriture liée
 * (journal, séances, traits...) avec des 42501 en cascade. L'appelant doit
 * retirer ces chevaux de l'état local plutôt que les garder.
 *
 * `hadUnexpectedError` : true si une erreur RÉSEAU/SERVEUR (pas le quota
 * attendu) a empêché au moins un cheval de se synchroniser — cf. audit du
 * 2026-09-16 : jusqu'ici, ces échecs n'étaient qu'un `console.warn` invisible
 * en production, sans aucun moyen pour l'utilisateur de savoir qu'une
 * modification n'était jamais partie. L'appelant s'en sert pour afficher un
 * indicateur "non synchronisé", jamais pour bloquer quoi que ce soit.
 *
 * `onlyIds` : restreint l'upsert (et les traits/blessures) à ces chevaux —
 * `horses` reste néanmoins la liste COMPLÈTE de l'écurie possédée, utilisée
 * telle quelle pour détecter les chevaux obsolètes à supprimer côté serveur
 * (cf. plus bas) ; ne jamais y passer une liste partielle sous peine de
 * supprimer par erreur des chevaux non modifiés. Cf. audit du 2026-09-16 :
 * avant, `persist()` republiait TOUTE l'écurie (upsert + traits + une
 * lecture) à la moindre modification d'un seul cheval — renommer l'un de 5
 * chevaux déclenchait 5 upserts. Omis (undefined), tous les `horses` fournis
 * sont upsertés — comportement historique, utilisé pour les opérations
 * intrinsèquement globales (replaceHorses, removeHorse).
 *
 * `skipped` : true quand rien n'a pu être tenté (pas de session, ou pas
 * encore de rider_profile côté serveur). Ce n'est pas une erreur à montrer à
 * l'utilisateur, mais l'appelant doit retenir que l'écurie reste à
 * synchroniser — cf. horses/store.tsx, qui repasse alors en push global au
 * prochain appel plutôt que de ne republier que le cheval suivant modifié. */
async function pushHorsesImpl(
  horses: Horse[],
  onlyIds?: string[]
): Promise<{
  photoUpdates: Array<{ id: string; photoPath: string | null }>;
  rejectedIds: string[];
  hadUnexpectedError: boolean;
  skipped: boolean;
}> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { photoUpdates: [], rejectedIds: [], hadUnexpectedError: false, skipped: true };

  const profile = await getOwnerProfile(userId);
  // Pas encore de rider_profile côté serveur (ex: confirmation email en
  // attente, cf. (onboarding)/account.tsx) : on retentera au prochain push,
  // pushRiderProfile() crée la ligne dès qu'une session existe.
  if (!profile) return { photoUpdates: [], rejectedIds: [], hadUnexpectedError: false, skipped: true };

  const now = new Date().toISOString();
  const photoUpdates: Array<{ id: string; photoPath: string | null }> = [];
  const rejectedIds: string[] = [];
  let hadUnexpectedError = false;
  // Un cheval à la fois, pas un upsert groupé : Postgres/RLS rejette un
  // upsert multi-lignes EN BLOC si UNE SEULE ligne viole le WITH CHECK (cf.
  // rls.sql horses_insert_own, quota du palier) — avec un upsert groupé, un
  // compte resté gratuit après avoir créé 2 chevaux en onboarding perdait
  // silencieusement les DEUX (pas juste le 2ᵉ en trop), cf. audit du
  // 2026-09-03. Séparé, seul le cheval en trop échoue ; les autres, dans la
  // limite, sont bien sauvegardés.
  const toUpsert = onlyIds ? horses.filter((h) => onlyIds.includes(h.id)) : horses;
  for (const h of toUpsert) {
    let photoPath = h.photoPath;
    // Cheval pas encore en base : le stockage refuse sa photo (rls.sql
    // horse_photos_insert_own exige owns_horse, donc la ligne). Elle est
    // renvoyée juste APRÈS l'enregistrement du cheval — avant, un cheval créé
    // avec sa photo partait sans elle, et la photo ne vivait que sur ce
    // téléphone : perdue au changement d'appareil, à la réinstallation ou à la
    // reconnexion (cf. audit du 2026-10-01).
    let uploadAfterSave = false;
    if (h.photoUrl?.startsWith("file://")) {
      // Photo fraîchement choisie (jamais un chemin distant) : à uploader. En
      // cas d'échec réseau, on garde l'ancien photoPath — retenté au prochain
      // push plutôt que de perdre la référence existante.
      const uploaded = await uploadHorsePhoto(h.id, h.photoUrl);
      if (uploaded) photoPath = uploaded;
      else uploadAfterSave = true;
    } else if (h.photoUrl === null && h.photoPath) {
      await deleteHorsePhotoRemote(h.id);
      photoPath = null;
    }
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
    if (!error && uploadAfterSave && h.photoUrl) {
      const uploaded = await uploadHorsePhoto(h.id, h.photoUrl);
      if (uploaded) {
        const { error: photoError } = await supabase
          .from("horses")
          .update({ photoPath: uploaded, updatedAt: now })
          .eq("id", h.id);
        if (photoError) console.warn("[cloudSync] enregistrement de la photo du cheval échoué", h.id, photoError);
        else photoPath = uploaded;
      }
    }
    if (!error) recordWriteSuccess("horses", h.id, false);
    if (error) {
      console.warn("[cloudSync] upsert horse échoué", h.id, error);
      if (error.message?.toLowerCase().includes("horse quota exceeded")) {
        rejectedIds.push(h.id);
      } else {
        hadUnexpectedError = true;
      }
    } else if (photoPath !== h.photoPath) {
      // Signalé seulement si la ligne a bien été enregistrée (cf. audit du
      // 2026-09-16) : avant, cette mise à jour était poussée dans l'état
      // local même quand l'upsert échouait juste après, faisant croire à une
      // synchro réussie alors que la ligne serveur n'avait pas bougé.
      photoUpdates.push({ id: h.id, photoPath });
    }
  }

  // Plus AUCUNE suppression déduite ici (« tout cheval distant absent de cet
  // appareil ») : l'app ne relit le serveur qu'à la connexion, donc un second
  // appareil connecté au même compte ignore les chevaux ajoutés ailleurs — et
  // un push global (rattrapage après un simple échec réseau, cf.
  // horses/store.tsx needsFullSyncRef) supprimait alors ces chevaux côté
  // serveur, avec en cascade tous leurs rendez-vous, séances, journal et
  // dépenses. Une suppression est désormais toujours explicite et ciblée :
  // cf. deleteHorseRemote, appelée par removeHorse.

  for (const horse of toUpsert) {
    // Jamais créé côté serveur (cf. rejectedIds ci-dessus) : y pousser ses
    // traits/blessures échouerait de toute façon en RLS (aucune ligne
    // "horses" à référencer), inutile de tenter.
    if (rejectedIds.includes(horse.id)) continue;
    await pushHorseTraitsAndInjuries(horse);
  }

  // Confirmation explicite avant de faire supprimer un cheval en local par
  // l'appelant (cf. horses/store.tsx persist) — jamais sur la seule foi du
  // message d'erreur "horse quota exceeded" ci-dessus. Cf. audit du
  // 2026-09-16 (C1/C2) : cette même erreur a déjà été renvoyée à tort par le
  // passé pour des chevaux parfaitement existants (bug de comptage du quota
  // corrigé dans enforce_horse_quota, cf. rls.sql) — un futur bug similaire
  // ne doit plus jamais se traduire par une suppression locale erronée. Si
  // la ligne existe malgré tout côté serveur, on la laisse en l'état plutôt
  // que de la retirer : elle sera resynchronisée normalement au prochain push.
  let confirmedRejectedIds = rejectedIds;
  if (rejectedIds.length > 0) {
    const { data: stillPresent, error: verifyError } = await supabase.from("horses").select("id").in("id", rejectedIds);
    if (verifyError) {
      console.warn("[cloudSync] vérification des chevaux refusés échouée, aucune suppression locale", verifyError);
      confirmedRejectedIds = [];
    } else {
      const presentIds = new Set((stillPresent ?? []).map((r) => r.id));
      confirmedRejectedIds = rejectedIds.filter((id) => !presentIds.has(id));
    }
  }

  return { photoUpdates, rejectedIds: confirmedRejectedIds, hadUnexpectedError, skipped: false };
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

/** Tags d'un même type, sans doublon. Des synchros qui se chevauchaient
 * (cf. horses/store.tsx persist, désormais en file) ont pu laisser deux lignes
 * pour le même tag côté serveur : les afficher deux fois ne rendrait service à
 * personne, et la déduplication à la lecture nettoie aussi les comptes déjà
 * touchés. L'ordre de première apparition est conservé. */
function tagsOfKind(traits: RemoteTrait[], kind: string): string[] {
  return [...new Set(traits.filter((t) => t.kind === kind).map((t) => t.tag))];
}

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
    strengths: tagsOfKind(h.horse_traits, "STRENGTH"),
    weaknesses: tagsOfKind(h.horse_traits, "WEAKNESS"),
    temperament: tagsOfKind(h.horse_traits, "TEMPERAMENT"),
    healthConditions: tagsOfKind(h.horse_traits, "HEALTH_CONDITION"),
    // Pas encore synchronisé côté serveur (cf. décision lors de son ajout) —
    // l'utilisateur devra le ressaisir une fois après une restauration.
    restDayActivities: [],
    injuries: h.horse_injuries.map((i) => ({
      id: i.id,
      type: i.type,
      occurredAt: parseServerDateOrNull(i.occurredAt),
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

/** Devine l'extension/le type MIME réels du fichier local plutôt que de
 * forcer ".jpg"/"image/jpeg" pour tout (cf. audit pré-publication) : un
 * document du coffre-fort peut être un PDF (cf. pickAndPersistDocument),
 * et un objet Storage uploadé avec un mauvais Content-Type ne s'affiche pas
 * correctement une fois resservi (signed URL). */
function documentContentType(localUri: string): { ext: string; contentType: string } {
  const ext = localUri.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return { ext: "pdf", contentType: "application/pdf" };
  if (ext === "png") return { ext: "png", contentType: "image/png" };
  return { ext: ext && /^[a-z0-9]{2,5}$/.test(ext) ? ext : "jpg", contentType: "image/jpeg" };
}

async function uploadDocumentPhoto(userId: string, docId: string, localUri: string): Promise<string | null> {
  try {
    const bytes = await new File(localUri).bytes();
    const { ext, contentType } = documentContentType(localUri);
    const path = `${userId}/${docId}.${ext}`;
    const { error } = await supabase.storage.from("documents").upload(path, bytes, {
      contentType,
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
async function pushDocumentImpl(doc: Doc, stamp?: number): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const profile = await getOwnerProfile(userId);
  if (!profile) return null;

  let filePath = doc.filePath;
  if (doc.fileUri?.startsWith("file://")) {
    const uploaded = await uploadDocumentPhoto(userId, doc.id, doc.fileUri);
    if (uploaded) {
      // Le chemin inclut l'extension réelle (documentContentType) — un
      // remplacement qui change de type de fichier (ex: jpg → pdf) upload donc
      // à un NOUVEAU chemin plutôt que d'écraser l'ancien objet (contrairement
      // au cas même-extension, cf. commentaire au-dessus de cette fonction).
      // Sans ce nettoyage, l'ancien objet restait orphelin dans Storage,
      // jamais référencé par aucune ligne `documents` et donc invisible/
      // impossible à supprimer depuis l'app.
      if (doc.filePath && doc.filePath !== uploaded) {
        await supabase.storage.from("documents").remove([doc.filePath]).catch(() => {});
      }
      filePath = uploaded;
    }
  }

  const row = {
    id: doc.id,
    riderId: profile.id,
    horseId: doc.horseId,
    category: categoryToDb(doc.category),
    name: doc.name,
    date: doc.date.toISOString(),
    filePath,
    updatedAt: new Date().toISOString(),
  };
  const { error } = await supabase.from("documents").upsert(row);
  // Hors ligne : la ligne attend dans la file de reprise au lieu d'être
  // perdue (le fichier, lui, est renvoyé par retryPendingDocumentUploads).
  await settleWrite("pushDocument", "documents", doc.id, error, row, stamp);
  return error ? null : filePath;
}

/** `filePath` doit être le chemin Storage réel du document (cf. Doc.filePath,
 * rapporté par pullDocuments/pushDocument) — un document peut être un PDF ou
 * un PNG (cf. documentContentType), pas seulement un ".jpg" : reconstruire le
 * chemin en supposant ".jpg" ratait la suppression Storage pour tout autre
 * type de fichier, laissant l'objet orphelin indéfiniment (la ligne DB
 * disparaît, donc plus aucune référence ne permet de le retrouver ensuite). */
async function deleteDocumentRemoteImpl(docId: string, filePath: string | null, stamp?: number): Promise<void> {
  const { error } = await supabase.from("documents").delete().eq("id", docId);
  await settleWrite("deleteDocumentRemote", "documents", docId, error, undefined, stamp);
  if (!filePath) return;
  // Best-effort : si l'objet Storage ne se supprime pas, RLS empêche de
  // toute façon tout accès par un autre utilisateur — pas une fuite.
  await supabase.storage.from("documents").remove([filePath]).catch(() => {});
}

/** Restaure le coffre-fort depuis Supabase (cf. (auth)/login.tsx, même
 * déclencheur que pullCloudData). Les URLs étant signées (bucket privé,
 * validité 7 jours), elles sont régénérées à chaque appel — donc à chaque
 * connexion sur un appareil qui n'a pas déjà les données locales.
 * Retourne `null` (jamais `[]`) sur tout échec réseau/auth/RLS — distingue
 * "on n'a pas pu vérifier" de "vraiment aucun document", pour que l'appelant
 * (login.tsx) n'écrase jamais l'état local existant avec un résultat qui ne
 * reflète pas la vraie donnée distante (cf. audit du 2026-09-09). */
export async function pullDocuments(): Promise<Doc[] | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const profile = await getOwnerProfile(userId);
  if (!profile) return null;

  const { data, error } = await supabase
    .from("documents")
    .select("id, horseId, category, name, date, filePath")
    .eq("riderId", profile.id);
  if (error || !data) return null;

  const docs: Doc[] = [];
  const signedFiles = await signPaths(
    "documents",
    data.map((row) => row.filePath).filter((p): p is string => !!p)
  );
  for (const row of data) {
    const fileUri = row.filePath ? (signedFiles.get(row.filePath) ?? null) : null;
    docs.push({
      id: row.id,
      horseId: row.horseId ?? null,
      category: categoryFromDb(row.category),
      name: row.name,
      date: parseServerDate(row.date),
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
async function pushAppointmentImpl(appt: Appointment, stamp?: number): Promise<void> {
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

async function deleteAppointmentRemoteImpl(apptId: string, stamp?: number): Promise<void> {
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
async function pushCompetitionEntryImpl(appointmentId: string, entry: CompetitionEntry, stamp?: number): Promise<void> {
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

async function upsertWithOptionalColumns(
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
async function selectWithOptionalColumns<T>(table: string, base: string, optional: string[]): Promise<T[] | null> {
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
async function pushJournalEntryImpl(
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
    ["activityKind", "videoPath"],
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
async function deleteJournalEntryRemoteImpl(entryId: string, horseId: string | null, stamp?: number): Promise<void> {
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

async function pushTrainingSessionImpl(session: TrainingSession, stamp?: number): Promise<void> {
  if (!session.horseId) return;
  const row = {
    id: session.id,
    horseId: session.horseId,
    ...activityToServer(session.activityType),
    customActivityLabel: session.customActivityLabel,
    date: session.date.toISOString(),
    time: session.time,
    durationMinutes: session.durationMinutes,
    intensity: session.intensity,
    notes: session.notes,
    completed: session.completed,
    updatedAt: new Date().toISOString(),
  };
  await upsertWithOptionalColumns("pushTrainingSession", "training_sessions", session.id, row, ["activityKind"], stamp);
}

async function deleteTrainingSessionRemoteImpl(sessionId: string, stamp?: number): Promise<void> {
  const { error } = await supabase.from("training_sessions").delete().eq("id", sessionId);
  await settleWrite("deleteTrainingSessionRemote", "training_sessions", sessionId, error, undefined, stamp);
}

/**
 * Parcours d'une séance enregistrée en direct — table à part
 * (training_session_rides), pour que la synchro des séances ne dépende jamais
 * de celle des parcours : tant que la table manque (SQL pas encore exécuté),
 * l'écriture échoue et attend dans la file, la séance, elle, est arrivée.
 */
async function pushSessionRideImpl(sessionId: string, horseId: string, ride: SessionRide, stamp?: number): Promise<void> {
  const row = {
    id: sessionId,
    sessionId,
    horseId,
    startedAt: ride.startedAt.toISOString(),
    endedAt: ride.endedAt.toISOString(),
    durationSeconds: ride.durationSeconds,
    distanceMeters: ride.distanceMeters,
    walkSeconds: ride.walkSeconds,
    trotSeconds: ride.trotSeconds,
    canterSeconds: ride.canterSeconds,
    haltSeconds: ride.haltSeconds,
    maxSpeedKmh: ride.maxSpeedKmh,
    avgSpeedKmh: ride.avgSpeedKmh,
    gps: ride.gps,
    route: ride.route,
    updatedAt: new Date().toISOString(),
  };
  const { error } = await supabase.from("training_session_rides").upsert(row);
  await settleWrite("pushSessionRide", "training_session_rides", sessionId, error, row, stamp);
}

type RideRow = {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  distanceMeters: number;
  walkSeconds: number;
  trotSeconds: number;
  canterSeconds: number;
  haltSeconds: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  gps: boolean;
  route: string | null;
};

/** Parcours visibles (mêmes règles de partage que les séances), par séance ;
 * null si la lecture échoue (table absente comprise). */
async function pullSessionRides(): Promise<Map<string, SessionRide> | null> {
  const { data, error } = await supabase
    .from("training_session_rides")
    .select(
      "sessionId, startedAt, endedAt, durationSeconds, distanceMeters, walkSeconds, trotSeconds, canterSeconds, haltSeconds, maxSpeedKmh, avgSpeedKmh, gps, route"
    );
  if (error || !data) return null;
  return new Map(
    (data as RideRow[]).map((row) => [
      row.sessionId,
      {
        startedAt: new Date(row.startedAt),
        endedAt: new Date(row.endedAt),
        durationSeconds: row.durationSeconds,
        distanceMeters: row.distanceMeters,
        walkSeconds: row.walkSeconds,
        trotSeconds: row.trotSeconds,
        canterSeconds: row.canterSeconds,
        haltSeconds: row.haltSeconds,
        maxSpeedKmh: row.maxSpeedKmh,
        avgSpeedKmh: row.avgSpeedKmh,
        gps: row.gps,
        route: row.route ?? null,
      },
    ])
  );
}

/** Restaure les séances visibles par l'utilisateur courant — possédées ET
 * partagées (géré entièrement par RLS, cf. pullAppointments ci-dessus).
 * Chaque séance porte son parcours (`ride`) : null s'il n'y en a pas,
 * undefined si les parcours n'ont pas pu être lus (cf. keepLocalRide). */
type SessionRow = {
  id: string;
  horseId: string;
  activityType: string;
  activityKind?: string | null;
  customActivityLabel: string | null;
  date: string;
  time: string;
  durationMinutes: number | null;
  intensity: string | null;
  notes: string;
  completed: boolean;
};

export async function pullTrainingSessions(): Promise<TrainingSession[] | null> {
  const [data, rides] = await Promise.all([
    selectWithOptionalColumns<SessionRow>(
      "training_sessions",
      "id, horseId, activityType, customActivityLabel, date, time, durationMinutes, intensity, notes, completed",
      ["activityKind"]
    ),
    pullSessionRides().catch(() => null),
  ]);
  if (!data) return null;
  return data.map((row) => ({
    ride: rides ? (rides.get(row.id) ?? null) : undefined,
    id: row.id,
    horseId: row.horseId,
    activityType: activityFromServer(row.activityType, row.activityKind),
    customActivityLabel: row.customActivityLabel ?? null,
    date: parseServerDate(row.date),
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

async function pushWeightMeasurementImpl(measurement: WeightMeasurement, stamp?: number): Promise<void> {
  const row = {
    id: measurement.id,
    horseId: measurement.horseId,
    weightKg: measurement.weightKg,
    date: measurement.date.toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const { error } = await supabase.from("horse_weight_measurements").upsert(row);
  await settleWrite("pushWeightMeasurement", "horse_weight_measurements", measurement.id, error, row, stamp);
}

async function deleteWeightMeasurementRemoteImpl(id: string, stamp?: number): Promise<void> {
  const { error } = await supabase.from("horse_weight_measurements").delete().eq("id", id);
  await settleWrite("deleteWeightMeasurementRemote", "horse_weight_measurements", id, error, undefined, stamp);
}

export async function pullWeightMeasurements(): Promise<WeightMeasurement[] | null> {
  const { data, error } = await supabase.from("horse_weight_measurements").select("id, horseId, weightKg, date");
  if (error || !data) return null;
  return data.map((row) => ({
    id: row.id,
    horseId: row.horseId,
    weightKg: row.weightKg,
    date: parseServerDate(row.date),
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

async function pushExpenseImpl(expense: Expense, stamp?: number): Promise<void> {
  if (!expense.horseId) return;
  const row = {
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
  };
  const { error } = await supabase.from("expenses").upsert(row);
  await settleWrite("pushExpense", "expenses", expense.id, error, row, stamp);
}

async function deleteExpenseRemoteImpl(expenseId: string, stamp?: number): Promise<void> {
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
  await settleWrite("deleteExpenseRemote", "expenses", expenseId, error, undefined, stamp);
}

/** Restaure les dépenses visibles par l'utilisateur courant — possédées ET
 * partagées (géré entièrement par RLS, cf. pullAppointments ci-dessus). Le
 * lien vers un document (reçu) n'est PAS résolu ici en jointure imbriquée :
 * un collaborateur consultant une dépense partagée dont le reçu appartient
 * au propriétaire (RLS `documents` = owns_rider_profile, jamais partagée) ne
 * l'aura de toute façon jamais dans son propre `pullDocuments()` — l'écran
 * (cf. app/horse/[id]/budget.tsx) affiche "reçu non disponible" en croisant localement
 * `documentId` avec la liste de documents déjà chargée par l'utilisateur
 * courant, sans appel réseau supplémentaire ni fuite. */
export async function pullExpenses(): Promise<Expense[] | null> {
  const { data, error } = await supabase
    .from("expenses")
    .select("id, horseId, amount, currency, category, date, notes, appointmentId, documentId, isPaid");
  if (error || !data) return null;
  return data.map((row) => ({
    id: row.id,
    horseId: row.horseId,
    amount: Number(row.amount),
    currency: row.currency,
    category: expenseCategoryFromDb(row.category),
    date: parseServerDate(row.date),
    notes: row.notes,
    appointmentId: row.appointmentId ?? null,
    documentId: row.documentId ?? null,
    isPaid: row.isPaid ?? false,
  }));
}

// Écritures suivies (cf. lib/remoteIndex.ts) : tant qu'une écriture est en
// vol, une relecture du serveur ne doit pas écraser la version locale qu'elle
// envoie. Chaque fonction exportée enveloppe son implémentation `…Impl`.

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

/**
 * Fiche complémentaire d'un cheval (identité, alimentation) : une ligne par
 * cheval, même portée de partage que ses séances (cf. extras/model.ts).
 */
async function pushHorseDetailsImpl(details: HorseDetails, stamp?: number): Promise<void> {
  const row = {
    horseId: details.horseId,
    identity: details.identity,
    feeding: details.feeding,
    partnership: details.partnership,
    updatedAt: details.updatedAt,
  };
  await upsertWithOptionalColumns("pushHorseDetails", "horse_details", details.horseId, row, ["partnership"], stamp);
}

export function pushHorseDetails(details: HorseDetails) {
  return withWriteTracking("horse_details", details.horseId, (stamp) => pushHorseDetailsImpl(details, stamp));
}

/** Lignes brutes, relues par extras/store.ts (normalizeDetails). null si
 * la lecture échoue — table absente comprise. */
type HorseDetailsRow = { horseId: string; identity: unknown; feeding: unknown; partnership?: unknown; updatedAt: string };

export async function pullHorseDetails(): Promise<HorseDetailsRow[] | null> {
  return selectWithOptionalColumns<HorseDetailsRow>("horse_details", "horseId, identity, feeding, updatedAt", ["partnership"]);
}

/** Carnet de contacts : personnel au cavalier (RLS userId = auth.uid()). */
async function pushContactImpl(contact: Contact, stamp?: number): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return;
  const row = { ...contact, userId };
  const { error } = await supabase.from("rider_contacts").upsert(row);
  await settleWrite("pushContact", "rider_contacts", contact.id, error, row, stamp);
}

export function pushContact(contact: Contact) {
  return withWriteTracking("rider_contacts", contact.id, (stamp) => pushContactImpl(contact, stamp));
}

async function deleteContactRemoteImpl(id: string, stamp?: number): Promise<void> {
  const { error } = await supabase.from("rider_contacts").delete().eq("id", id);
  await settleWrite("deleteContactRemote", "rider_contacts", id, error, undefined, stamp);
}

export function deleteContactRemote(id: string) {
  return withWriteTracking("rider_contacts", id, (stamp) => deleteContactRemoteImpl(id, stamp), "delete");
}

export async function pullContacts(): Promise<Contact[] | null> {
  const { data, error } = await supabase
    .from("rider_contacts")
    .select("id, name, role, phone, email, notes, updatedAt");
  if (error || !data) return null;
  return data as Contact[];
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
