import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase";
import { recordWriteSuccess } from "@/lib/remoteIndex";
import { parseServerDateOrNull } from "@/lib/serverDate";
import type { RiderProfile } from "@/rider/store";
import type { Horse } from "@/horses/store";
import { SIGNED_URL_TTL_SECONDS, generateId, getOwnerProfile, settleWrite } from "./shared";

/** Profil cavalier et chevaux (photos, traits, blessures) : envoi et relecture.
 * Extrait de lib/cloudSync.ts (façade) sans changement de comportement. */

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
export async function deleteHorseRemoteImpl(horseId: string, stamp?: number): Promise<void> {
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
export async function pushHorsesImpl(
  horses: Horse[],
  onlyIds?: string[]
): Promise<{
  photoUpdates: { id: string; photoPath: string | null }[];
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
  const photoUpdates: { id: string; photoPath: string | null }[] = [];
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
