import { readJson, writeJson } from "@/lib/localStore";

/**
 * Registre de l'état de synchronisation de chaque ligne (table + id), qui
 * permet de fusionner une relecture du serveur avec les données locales sans
 * rien perdre (cf. lib/mergeRemote.ts, lib/cloudRefresh.ts) :
 *
 * - `known` : lignes dont on SAIT qu'elles existent côté serveur (vues à une
 *   relecture, ou écrites avec succès), avec le moment où on l'a appris.
 *   Seule une ligne connue peut être supprimée localement parce qu'elle a
 *   disparu du serveur — une ligne jamais envoyée ne l'est jamais.
 * - `tombstones` : lignes supprimées avec succès depuis cet appareil, avec
 *   leur date — une relecture partie AVANT cette suppression ne doit pas les
 *   faire réapparaître.
 * - `inFlight` : écritures en cours d'envoi, que la fusion ne doit pas écraser.
 * - `unconfirmed` : écritures parties mais pas encore confirmées par le
 *   serveur. Contrairement à `inFlight`, persisté : quitter l'app pendant un
 *   envoi (le cas le plus courant : on enregistre puis on ferme) perdait la
 *   trace de la modification, et la relecture suivante la remplaçait par
 *   l'ancienne version du serveur — une séance déplacée au lendemain
 *   « revenait » à aujourd'hui (cf. audit du 2026-10-01). La ligne reste
 *   protégée et est renvoyée jusqu'à confirmation (cf. syncGuard.needsResend).
 *
 * `known`, `tombstones` et `unconfirmed` sont persistés (fichier local) ;
 * `inFlight` vit en mémoire. Tout est vidé au changement de compte (cf.
 * syncQueue.clearSyncQueue).
 */

const KEY = "remote_index_v1";
const TOMBSTONE_TTL_MS = 24 * 60 * 60 * 1000;
const UNCONFIRMED_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type WriteKind = "upsert" | "delete";
type Unconfirmed = { at: number; op: WriteKind };
type Persisted = {
  known: Record<string, number>;
  tombstones: Record<string, number>;
  unconfirmed?: Record<string, Unconfirmed>;
};

let known = new Map<string, number>();
let tombstones = new Map<string, number>();
const inFlight = new Map<string, number>();
let unconfirmed = new Map<string, Unconfirmed>();
let loaded = false;
let loading: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function rowKey(table: string, id: string): string {
  return `${table}\u0000${id}`;
}

/** Incrémenté par clearRemoteIndex (changement de compte) : une relecture du
 * fichier encore en cours appartient au compte précédent et ne doit rien
 * réinjecter une fois l'index vidé. */
let generation = 0;

export function loadRemoteIndex(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!loading) {
    const startedGeneration = generation;
    loading = readJson<Persisted>(KEY, { known: {}, tombstones: {} })
      .then((data) => {
        if (generation !== startedGeneration) return;
        // Des écritures ont pu arriver avant la fin de la lecture : on les
        // garde (elles sont plus récentes que le fichier).
        known = new Map([...Object.entries(data.known ?? {}), ...known]);
        const now = Date.now();
        const fresh = Object.entries(data.tombstones ?? {}).filter(([, at]) => now - at < TOMBSTONE_TTL_MS);
        tombstones = new Map([...fresh, ...tombstones]);
        // Au-delà de 30 jours, une marque ne protège plus qu'une écriture que
        // le serveur refuse durablement (ou une ligne disparue) : oubliée.
        const recent = Object.entries(data.unconfirmed ?? {}).filter(([, u]) => now - u.at < UNCONFIRMED_TTL_MS);
        unconfirmed = new Map([...recent, ...unconfirmed]);
      })
      .catch(() => {})
      .finally(() => {
        loaded = true;
      });
  }
  return loading;
}

function snapshot(): Persisted {
  return {
    known: Object.fromEntries(known),
    tombstones: Object.fromEntries(tombstones),
    unconfirmed: Object.fromEntries(unconfirmed),
  };
}

function scheduleSave(): void {
  // Pas encore relu depuis le disque : écrire maintenant remplacerait le
  // fichier par ce seul état en mémoire, et effacerait ce qu'il contenait
  // (lignes connues, envois non confirmés d'une session précédente).
  if (!loaded) {
    void loadRemoteIndex().then(scheduleSave);
    return;
  }
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    writeJson(KEY, snapshot()).catch(() => {});
  }, 500);
}

/** Écriture immédiate, sans le délai de scheduleSave : une modification qui
 * part doit être notée sur le disque AVANT que l'utilisateur ait le temps de
 * fermer l'app. */
let saveNowQueued = false;

function saveNow(): void {
  if (!loaded) {
    void loadRemoteIndex().then(saveNow);
    return;
  }
  // Regroupées en une écriture par tour de la boucle d'événements : une
  // séance répétée sur un an part en dizaines d'envois d'un coup, une écriture
  // complète du fichier par envoi bloquait inutilement l'interface. La
  // microtâche s'exécute avant que l'app puisse être suspendue.
  if (saveNowQueued) return;
  saveNowQueued = true;
  queueMicrotask(() => {
    saveNowQueued = false;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    writeJson(KEY, snapshot()).catch(() => {});
  });
}

/** Horodatage d'écriture strictement croissant : deux écritures parties dans
 * la même milliseconde restent ordonnées. Fondé sur l'horloge, donc comparable
 * aux marques relues du disque après un redémarrage. */
let lastStamp = 0;

function nextStamp(): number {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

/** Une écriture part (upsert ou suppression) : la fusion la protège jusqu'à
 * sa conclusion — et, si l'app est fermée avant, jusqu'à ce que le serveur
 * l'ait confirmée (cf. `unconfirmed`). Rend l'horodatage de l'écriture, à
 * rendre à `recordWriteSuccess`/`confirmWrite` : seule la confirmation de la
 * DERNIÈRE écriture partie lève la marque. */
export function beginWrite(table: string, id: string, op: WriteKind | null = "upsert"): number {
  const key = rowKey(table, id);
  inFlight.set(key, (inFlight.get(key) ?? 0) + 1);
  const stamp = nextStamp();
  // `null` : protection pendant l'envoi seulement, sans marque durable.
  if (op === null) return stamp;
  unconfirmed.set(key, { at: stamp, op });
  saveNow();
  return stamp;
}

/** Fin d'envoi (réussi ou non) : la ligne n'est plus « en vol ». */
export function endWrite(table: string, id: string): void {
  const key = rowKey(table, id);
  const count = (inFlight.get(key) ?? 1) - 1;
  if (count <= 0) inFlight.delete(key);
  else inFlight.set(key, count);
}

/** Écritures en cours ou en attente, par ligne : chacune part quand la
 * précédente a eu sa réponse. Lancées ensemble, deux versions d'une même
 * ligne (trois cases de checklist cochées d'affilée, une reprise de la file
 * pendant une nouvelle saisie…) pouvaient arriver au serveur dans le
 * désordre : la plus ancienne, arrivée la dernière, y restait, alors que
 * l'app tenait la ligne pour confirmée — et la relecture suivante remplaçait
 * la saisie par cette ancienne version. */
const chains = new Map<string, Promise<unknown>>();

/** Exécute `run` après toutes les écritures déjà engagées sur cette ligne. */
export function serializeWrite<R>(table: string, id: string, run: () => Promise<R>): Promise<R> {
  const key = rowKey(table, id);
  const previous = chains.get(key) ?? Promise.resolve();
  const current = previous.then(run, run);
  const settled = current.then(
    () => {},
    () => {}
  );
  chains.set(key, settled);
  void settled.then(() => {
    if (chains.get(key) === settled) chains.delete(key);
  });
  return current;
}

/** Enveloppe une écriture : protégée par la fusion dès son départ, envoyée
 * après les écritures précédentes de la même ligne (cf. serializeWrite).
 * `write` reçoit l'horodatage de l'écriture (cf. beginWrite). */
export async function withWriteTracking<R>(
  table: string,
  id: string,
  write: (stamp: number) => Promise<R>,
  op: WriteKind | null = "upsert"
): Promise<R> {
  const stamp = beginWrite(table, id, op);
  try {
    return await serializeWrite(table, id, () => write(stamp));
  } finally {
    endWrite(table, id);
  }
}

/** Lève la marque « envoyée sans confirmation » d'une ligne si l'écriture
 * confirmée (partie à `startedAt`) est au moins aussi récente qu'elle : une
 * écriture plus récente garde sa marque jusqu'à sa propre confirmation. */
export function confirmWrite(table: string, id: string, startedAt: number): void {
  const key = rowKey(table, id);
  const mark = unconfirmed.get(key);
  if (!mark || mark.at > startedAt) return;
  unconfirmed.delete(key);
  scheduleSave();
}

/** Une écriture plus récente que `startedAt` a-t-elle été lancée sur cette
 * ligne (en cours, ou partie sans confirmation avant une fermeture) ? Une
 * reprise de la file plus ancienne ne doit alors PAS partir : elle
 * écraserait côté serveur une saisie plus récente, que la fusion renverra
 * elle-même (cf. syncGuard.needsResend, cloudSync.resendUnconfirmedDeletes). */
export function hasNewerWrite(table: string, id: string, startedAt: number): boolean {
  const mark = unconfirmed.get(rowKey(table, id));
  return !!mark && mark.at > startedAt;
}

/** Écriture acceptée par le serveur (directe ou rejouée depuis la file).
 * `startedAt` : horodatage de départ de cette écriture (cf. beginWrite) ;
 * absent, seule une écriture plus récente encore en vol garde la marque. */
export function recordWriteSuccess(table: string, id: string, deleted: boolean, startedAt?: number): void {
  const key = rowKey(table, id);
  const now = Date.now();
  if (deleted) {
    known.delete(key);
    tombstones.set(key, now);
  } else {
    known.set(key, now);
    tombstones.delete(key);
  }
  // Confirmée — sauf si une écriture plus récente de la même ligne est partie
  // depuis (elle lèvera elle-même la marque). Une reprise de la file
  // confirmait jusqu'ici n'importe quelle marque : rejouer une ancienne
  // version effaçait la trace d'une modification plus récente jamais
  // confirmée, que la relecture suivante remplaçait alors par cette ancienne
  // version (cf. audit du 2026-10-02).
  const mark = unconfirmed.get(key);
  if (mark && (startedAt === undefined ? (inFlight.get(key) ?? 0) <= 1 : mark.at <= startedAt)) {
    unconfirmed.delete(key);
  }
  scheduleSave();
}

/** Suppressions parties mais jamais confirmées (app fermée pendant l'envoi) :
 * la ligne a déjà disparu de l'appareil, il faut renvoyer la suppression (cf.
 * cloudSync.resendUnconfirmedDeletes). Hors écritures encore en vol. */
export function unconfirmedDeletes(): { table: string; id: string }[] {
  const out: { table: string; id: string }[] = [];
  for (const [key, entry] of unconfirmed) {
    if (entry.op !== "delete" || inFlight.has(key)) continue;
    const [table, id] = key.split("\u0000");
    if (table && id) out.push({ table, id });
  }
  return out;
}

/** Après une relecture réussie d'une table : les lignes renvoyées sont
 * connues. Celles qui ont disparu ne le sont plus — sauf si on les a apprises
 * APRÈS le départ de la relecture (écriture réussie pendant qu'elle était en
 * vol), auquel cas l'absence ne prouve rien. */
export function noteRemoteSnapshot(table: string, ids: string[], pullStartedAt: number): void {
  const prefix = `${table}\u0000`;
  const seen = new Set(ids.map((id) => rowKey(table, id)));
  for (const [key, at] of [...known]) {
    if (key.startsWith(prefix) && !seen.has(key) && at <= pullStartedAt) known.delete(key);
  }
  for (const key of seen) {
    const previous = known.get(key);
    // Garder la date la plus récente : une écriture réussie pendant la
    // relecture doit rester datée d'après son départ.
    if (previous === undefined || previous < pullStartedAt) known.set(key, pullStartedAt);
  }
  scheduleSave();
}

/** Vu par une restauration complète (connexion sur un appareil vierge). */
export function markAllKnown(table: string, ids: string[]): void {
  const now = Date.now();
  for (const id of ids) known.set(rowKey(table, id), now);
  scheduleSave();
}

export type SyncGuard = {
  /** La version locale fait autorité (en file, en vol, envoyée sans
   * confirmation, ou écrite après le départ de la relecture). */
  isProtected: (id: string) => boolean;
  /** Envoyée sans confirmation et plus en cours d'envoi ni en file : à
   * renvoyer (cf. mergeRemote.unsyncedLocalIds). */
  needsResend?: (id: string) => boolean;
  /** Connue côté serveur avant le départ de la relecture. */
  isKnown: (id: string) => boolean;
  /** Supprimée depuis cet appareil après le départ de la relecture. */
  isRecentlyDeleted: (id: string) => boolean;
};

/** Garde de fusion pour une table, figée à l'instant de l'appel. */
export function syncGuard(table: string, pullStartedAt: number, pendingIds: ReadonlySet<string>): SyncGuard {
  return {
    isProtected: (id) => {
      const key = rowKey(table, id);
      if (pendingIds.has(id) || inFlight.has(key) || unconfirmed.has(key)) return true;
      const at = known.get(key);
      return at !== undefined && at > pullStartedAt;
    },
    needsResend: (id) => {
      const key = rowKey(table, id);
      return unconfirmed.get(key)?.op === "upsert" && !inFlight.has(key) && !pendingIds.has(id);
    },
    isKnown: (id) => {
      const at = known.get(rowKey(table, id));
      return at !== undefined && at <= pullStartedAt;
    },
    isRecentlyDeleted: (id) => {
      const at = tombstones.get(rowKey(table, id));
      return at !== undefined && at > pullStartedAt;
    },
  };
}

/** Chevaux présents côté serveur (possédés + partagés) à la dernière relecture
 * complète, ou null si elle a échoué. Une ligne rattachée à un cheval absent
 * n'est pas renvoyée : elle attend que le cheval y soit (sinon refus RLS), ou
 * appartient à un cheval qui n'existe plus. */
let serverHorseIds: Set<string> | null = null;

export function noteServerHorses(ids: string[] | null): void {
  serverHorseIds = ids ? new Set(ids) : null;
}

/** `row.horseId` existe-t-il côté serveur ? Faux tant qu'on ne le sait pas. */
export function isHorseOnServer(horseId: string | null | undefined): boolean {
  return !!horseId && !!serverHorseIds?.has(horseId);
}

export async function clearRemoteIndex(): Promise<void> {
  generation++;
  loading = null;
  serverHorseIds = null;
  known = new Map();
  tombstones = new Map();
  unconfirmed = new Map();
  inFlight.clear();
  loaded = true;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await writeJson(KEY, { known: {}, tombstones: {}, unconfirmed: {} }).catch(() => {});
}

/** Tests uniquement : remet le module à zéro. */
export function __resetRemoteIndexForTests(): void {
  known = new Map();
  tombstones = new Map();
  unconfirmed = new Map();
  inFlight.clear();
  loaded = true;
  loading = null;
}

/** Tests uniquement : force une vraie relecture du fichier (redémarrage simulé). */
export function __markUnloadedForTests(): void {
  loaded = false;
  loading = null;
}
