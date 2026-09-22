import { Alert } from "react-native";
import * as SecureStore from "expo-secure-store";
import { File, Paths } from "expo-file-system";
import { safeJsonParse } from "@/lib/safeJsonParse";

/**
 * Stockage local des LISTES de l'app (rendez-vous, journal, dépenses,
 * documents, séances, pesées, objectifs, chevaux).
 *
 * Pourquoi ne plus passer par SecureStore : c'est le keychain iOS, prévu pour
 * des secrets courts. Expo avertit dès qu'une valeur dépasse 2 Ko — « it may
 * not be stored successfully. In a future SDK version, this call may throw an
 * error » — et un an d'historique dépasse largement ce seuil. Pire, toutes les
 * écritures étaient des `.catch(() => {})` : un échec ne se voyait nulle part,
 * l'app continuait avec son état en mémoire, et au redémarrage suivant les
 * données étaient revenues en arrière sans un mot.
 *
 * Ici : un fichier JSON par clé dans le répertoire Documents (persistant, non
 * purgé par l'OS contrairement au cache, et déjà utilisé pour les photos — cf.
 * lib/imagePicker.ts), et un échec d'écriture qui se DIT (cf. reportWriteFailure).
 *
 * Ce qui reste volontairement dans SecureStore : ce qui est court ET sensible
 * ou critique au démarrage — état d'abonnement, propriétaire de l'appareil,
 * identifiant du cheval actif, thème, dernier crash. Le keychain est le bon
 * endroit pour ces valeurs-là, et elles ne grossissent jamais.
 */

/** Nom de fichier pour une clé de store. Les clés existantes sont déjà des
 * identifiants sûrs (`training_sessions_v1`…) ; on borne quand même le jeu de
 * caractères, un nom de fichier n'ayant pas les mêmes règles qu'une clé de
 * keychain. */
function fileFor(key: string): File {
  return new File(Paths.document, `store-${key.replace(/[^a-zA-Z0-9_.-]/g, "_")}.json`);
}

/** Vrai tant que l'utilisateur n'a pas encore été prévenu d'un échec
 * d'écriture pendant cette session. Une seule alerte : si le disque est plein
 * ou le fichier inaccessible, CHAQUE modification échouera, et une alerte par
 * frappe rendrait l'app inutilisable. */
let writeFailureReported = false;

/** Prévient l'utilisateur qu'une sauvegarde locale a échoué. Silencieux hors
 * de la première fois (cf. `writeFailureReported`). Une perte de données
 * mérite d'être dite : c'est précisément ce que l'ancien `.catch(() => {})`
 * empêchait de savoir. */
function reportWriteFailure(key: string, error: unknown) {
  console.warn(`[localStore] écriture ${key} échouée`, error);
  if (writeFailureReported) return;
  writeFailureReported = true;
  Alert.alert(
    "Sauvegarde locale impossible",
    "Tes dernières modifications n'ont pas pu être enregistrées sur cet appareil. Vérifie l'espace de stockage disponible — tant que l'app reste ouverte, tu peux continuer, mais évite de la fermer."
  );
}

/** Remet le compteur d'alerte à zéro — utile après une déconnexion/changement
 * de compte, où repartir d'un état propre a du sens. */
export function resetWriteFailureNotice() {
  writeFailureReported = false;
}

/**
 * Lit la valeur d'une clé. Ordre de recherche :
 *
 * 1. le fichier JSON (source de vérité depuis cette version) ;
 * 2. à défaut, l'ancienne entrée SecureStore, qui est alors RECOPIÉE dans le
 *    fichier — c'est toute la migration, elle se fait à la première lecture
 *    de chaque store, sans écran de chargement ni étape explicite.
 *
 * L'ancienne entrée SecureStore n'est volontairement PAS supprimée : une
 * build antérieure réinstallée (TestFlight) retrouve ainsi ses données au
 * lieu d'un compte vide. Elle se fige au moment de la migration et pourra
 * être purgée par une version ultérieure, une fois l'ancienne hors d'usage.
 *
 * Ne lève jamais : faute de valeur exploitable des deux côtés, renvoie
 * `fallback` — comme le faisait `safeJsonParse` sur SecureStore.
 *
 * Une valeur littéralement `null` est traitée comme illisible. Aucun store
 * n'en persiste (tous écrivent un tableau ou un objet), et distinguer
 * « absent » de « null » coûterait plus cher que ce que ce cas rapporte.
 */
export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const file = fileFor(key);
    if (file.exists) {
      const parsed = safeJsonParse<T | null>(await file.text(), null);
      if (parsed !== null) return parsed;
      // Fichier présent mais inexploitable (écriture interrompue, contenu
      // tronqué) : on ne rend PAS un compte vide tant que l'ancienne copie
      // existe encore. Elle est périmée, mais elle est vraie.
      console.warn(`[localStore] fichier ${key} illisible, repli sur l'ancienne copie`);
    }
  } catch (e) {
    console.warn(`[localStore] lecture ${key} échouée`, e);
    // Même raison : on tente l'ancienne copie avant d'abandonner.
  }
  // Migration depuis SecureStore — et filet de secours du cas ci-dessus.
  try {
    const legacy = await SecureStore.getItemAsync(key);
    if (!legacy) return fallback;
    const parsed = safeJsonParse<T | null>(legacy, null);
    if (parsed === null) return fallback;
    // Best-effort : si la recopie échoue, on rend quand même la valeur lue.
    // Pas d'alerte ici — rien n'est perdu, l'ancienne entrée est intacte et
    // la migration sera retentée au prochain démarrage.
    try {
      fileFor(key).write(JSON.stringify(parsed));
    } catch (e) {
      console.warn(`[localStore] migration ${key} échouée`, e);
    }
    return parsed;
  } catch (e) {
    console.warn(`[localStore] lecture SecureStore ${key} échouée`, e);
    return fallback;
  }
}

/**
 * Écrit la valeur d'une clé. Retourne `true` si l'écriture a réussi.
 *
 * Contrairement à l'ancien `SecureStore.setItemAsync(...).catch(() => {})`,
 * un échec est remonté à l'utilisateur (cf. reportWriteFailure) ET au code
 * appelant, qui peut afficher son propre état (cf. `saveFailed` dans les
 * stores). Ne lève pas : ces appels partent d'effets de rendu, où une
 * exception non rattrapée casserait l'écran.
 */
export async function writeJson(key: string, value: unknown): Promise<boolean> {
  try {
    fileFor(key).write(JSON.stringify(value));
    return true;
  } catch (e) {
    reportWriteFailure(key, e);
    return false;
  }
}

/** Efface une clé — des deux stockages : après une déconnexion, laisser
 * l'ancienne copie SecureStore derrière soi rendrait les données du compte
 * précédent au prochain démarrage (cf. readJson, qui migre ce qu'il trouve). */
export async function removeJson(key: string): Promise<void> {
  try {
    const file = fileFor(key);
    if (file.exists) file.delete();
  } catch (e) {
    console.warn(`[localStore] suppression ${key} échouée`, e);
  }
  await SecureStore.deleteItemAsync(key).catch(() => {});
}
