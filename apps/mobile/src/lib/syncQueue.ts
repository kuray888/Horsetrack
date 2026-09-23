import { readJson, writeJson } from "@/lib/localStore";

/**
 * File d'attente des écritures cloud qui ont échoué.
 *
 * Avant, chaque push était un `.catch(() => {})` isolé : créer une séance au
 * manège sans réseau la laissait locale DÉFINITIVEMENT — rien ne la
 * repoussait ensuite. L'utilisateur croyait avoir sauvegardé, et perdait tout
 * en changeant de téléphone.
 *
 * Ici, une opération qui échoue est persistée, puis rejouée : au démarrage,
 * quand l'app revient au premier plan, et dès qu'une autre écriture réussit
 * (signe que le réseau est revenu).
 *
 * Volontairement générique — `{ table, op, row }` plutôt qu'un identifiant de
 * fonction : les push de cloudSync.ts construisent déjà des lignes prêtes
 * pour PostgREST (dates en ISO), donc rejouable tel quel, sans réveiller la
 * logique métier ni risquer qu'elle ait changé de forme entre-temps.
 *
 * Ce module ne dépend PAS de cloudSync.ts (qui, lui, en dépend) : pas de
 * cycle d'imports.
 */

export type SyncOperation = {
  /** Table PostgREST visée (`training_sessions`, `appointments`…). */
  table: string;
  /** `upsert` rejoue `row` ; `delete` supprime la ligne d'identifiant `id`. */
  op: "upsert" | "delete";
  /** Identifiant de la ligne — sert à la déduplication (cf. `mergeOperation`). */
  id: string;
  /** Ligne complète pour un upsert, absente pour un delete. */
  row?: Record<string, unknown>;
  /** Nombre de tentatives déjà échouées. */
  attempts: number;
};

const QUEUE_KEY = "sync_queue_v1";

/** Au-delà, on abandonne l'opération. Une écriture refusée pour une raison
 * qui ne passera jamais (ligne devenue invalide, permission retirée, cheval
 * supprimé côté serveur) ne doit pas être retentée sans fin : la file
 * grossirait à chaque reprise et retarderait les opérations réellement
 * récupérables. Cinq tentatives couvrent largement une coupure réseau, qui
 * est le cas visé. */
export const MAX_ATTEMPTS = 5;

/** Borne de sécurité : une file plus longue ne serait de toute façon jamais
 * vidée en une fois, et grossir sans fin ferait de la persistance locale une
 * charge à chaque écriture. Les PLUS ANCIENNES sont abandonnées en premier :
 * les récentes sont celles que l'utilisateur vient de saisir. */
export const MAX_QUEUE_LENGTH = 200;

/** Identité d'une ligne dans la file : c'est le couple table + id qui désigne
 * « la même donnée », et donc ce qu'une nouvelle saisie remplace. Extrait en
 * fonction pour que `mergeOperation` et `flushSyncQueue` ne puissent pas
 * diverger sur cette définition — c'est précisément leur désaccord qui faisait
 * perdre des saisies. */
function rowKey(operation: Pick<SyncOperation, "table" | "id">): string {
  return `${operation.table}\u0000${operation.id}`;
}

/**
 * Ajoute une opération à la file, en remplaçant celle qui visait déjà la même
 * ligne.
 *
 * Deux modifications successives de la même séance ne doivent pas produire
 * deux upserts — le second écraserait le premier de toute façon. Et un
 * `delete` qui suit un `upsert` non parti le remplace : rejouer l'upsert
 * ressusciterait une entrée supprimée.
 *
 * Le compteur de tentatives repart à zéro : c'est une nouvelle saisie de
 * l'utilisateur, pas une énième reprise de la précédente.
 */
export function mergeOperation(queue: SyncOperation[], operation: SyncOperation): SyncOperation[] {
  const without = queue.filter((o) => rowKey(o) !== rowKey(operation));
  const next = [...without, operation];
  return next.length > MAX_QUEUE_LENGTH ? next.slice(next.length - MAX_QUEUE_LENGTH) : next;
}

/** Codes PostgREST/Postgres qu'il est inutile de retenter : la même requête
 * échouera à l'identique. 42501 = permission refusée (RLS), 23503 = clé
 * étrangère absente (le cheval a été supprimé), 23505 = doublon, 22P02 =
 * valeur mal typée. Les distinguer évite qu'un refus définitif occupe la file
 * pendant cinq reprises et masque les écritures récupérables. */
const PERMANENT_ERROR_CODES = new Set(["42501", "23503", "23505", "22P02"]);

export function isPermanentError(error: { code?: string } | null | undefined): boolean {
  return !!error?.code && PERMANENT_ERROR_CODES.has(error.code);
}

/** Opérations à garder après une tentative de vidage : celles qui ont échoué
 * et qui n'ont pas épuisé leurs essais. Pure, pour être testable sans réseau. */
export function keepForRetry(operation: SyncOperation): SyncOperation | null {
  const attempts = operation.attempts + 1;
  return attempts >= MAX_ATTEMPTS ? null : { ...operation, attempts };
}

// — État en mémoire, miroir du fichier —

let queue: SyncOperation[] = [];
let loaded = false;
/** Empêche deux vidages concurrents (démarrage + retour au premier plan, par
 * exemple) de rejouer deux fois les mêmes opérations. */
let flushing = false;
/** Incrémenté par `clearSyncQueue`. Un vidage en vol compare ce compteur au
 * sien : s'il a changé, c'est qu'on a changé de compte pendant l'envoi, et le
 * vidage doit se taire au lieu de réinstaller la file qu'on venait d'effacer
 * — ces opérations appartiennent au compte précédent. */
let generation = 0;
const listeners = new Set<(pending: number) => void>();

function notify() {
  for (const listener of listeners) listener(queue.length);
}

/** S'abonne au nombre d'opérations en attente (cf. useSyncQueue). Retourne la
 * fonction de désabonnement. */
export function subscribeToSyncQueue(listener: (pending: number) => void): () => void {
  listeners.add(listener);
  listener(queue.length);
  return () => void listeners.delete(listener);
}

export function pendingSyncCount(): number {
  return queue.length;
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  queue = await readJson<SyncOperation[]>(QUEUE_KEY, []);
  loaded = true;
  notify();
}

async function persist(): Promise<void> {
  await writeJson(QUEUE_KEY, queue);
  notify();
}

/** Met une écriture échouée en attente de reprise. Silencieux si l'erreur est
 * définitive (cf. isPermanentError) : la retenter ne ferait que repousser le
 * moment où l'utilisateur constate qu'elle n'est jamais partie. */
export async function enqueueFailedWrite(
  operation: Omit<SyncOperation, "attempts">,
  error?: { code?: string } | null
): Promise<void> {
  if (isPermanentError(error)) return;
  await ensureLoaded();
  queue = mergeOperation(queue, { ...operation, attempts: 0 });
  await persist();
}

/**
 * Rejoue les opérations en attente. Ne lève jamais : appelée depuis des
 * effets et des `.catch`, où une exception n'aurait personne pour la
 * rattraper.
 *
 * `send` est injecté plutôt qu'importé : c'est ce qui permet à ce module de
 * ne pas dépendre de cloudSync.ts (et donc de rester testable sans Supabase).
 */
export async function flushSyncQueue(
  send: (operation: SyncOperation) => Promise<{ error: { code?: string } | null }>
): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    await ensureLoaded();
    if (queue.length === 0) return;
    // Copie : `queue` peut recevoir de nouvelles opérations pendant le vidage
    // (l'utilisateur continue de saisir), et elles ne doivent pas être
    // écrasées par le résultat de cette passe.
    const attempted = [...queue];
    const startedGeneration = generation;
    const failed: SyncOperation[] = [];
    for (const operation of attempted) {
      // Changement de compte en cours de route : on arrête d'envoyer
      // immédiatement. Continuer enverrait les écritures du compte précédent
      // sous l'identité du suivant, et ne compter que sur la RLS pour les
      // refuser reviendrait à faire du serveur le seul garde-fou.
      if (generation !== startedGeneration) return;
      try {
        const { error } = await send(operation);
        if (!error) continue;
        if (isPermanentError(error)) continue;
        const retry = keepForRetry(operation);
        if (retry) failed.push(retry);
      } catch {
        const retry = keepForRetry(operation);
        if (retry) failed.push(retry);
      }
    }
    // La file a été vidée volontairement pendant l'envoi (déconnexion,
    // changement de compte) : ne RIEN réécrire. `clearSyncQueue` a déjà
    // persisté une file vide, et réinstaller `failed` ressusciterait des
    // opérations qui appartiennent au compte précédent.
    if (generation !== startedGeneration) return;

    // Ce qui est arrivé pendant l'envoi se reconnaît à l'identité de l'objet,
    // pas au couple table+id : une nouvelle saisie sur la MÊME ligne produit un
    // objet différent, qu'on doit garder. L'ancienne comparaison par table+id
    // la confondait avec l'opération déjà tentée et la jetait — la modification
    // de l'utilisateur était alors perdue, et remplacée par le contenu périmé.
    const arrivedDuringFlush = queue.filter((o) => !attempted.includes(o));

    // Une opération retentée est abandonnée si l'utilisateur a saisi quelque
    // chose de plus récent sur la même ligne entre-temps : cette saisie-là fait
    // autorité. C'est ce qui empêche une suppression faite pendant l'envoi
    // d'être écrasée par l'upsert qu'elle annulait.
    const superseded = new Set(arrivedDuringFlush.map(rowKey));
    const stillPending = failed.filter((o) => !superseded.has(rowKey(o)));

    queue = [...stillPending, ...arrivedDuringFlush];
    await persist();
  } finally {
    flushing = false;
  }
}

/** Vide la file sans rien envoyer — changement/déconnexion de compte : ces
 * opérations appartiennent au compte précédent et ne doivent surtout pas
 * partir sous l'identité du suivant. */
export async function clearSyncQueue(): Promise<void> {
  // Marque une nouvelle génération : un vidage déjà en vol s'arrêtera au lieu
  // de réinstaller ce qu'on efface ici (cf. `generation`).
  generation++;
  queue = [];
  loaded = true;
  await persist();
}
