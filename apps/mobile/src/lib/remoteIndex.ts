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
 *
 * `known` et `tombstones` sont persistés (fichier local) ; `inFlight` vit en
 * mémoire. Tout est vidé au changement de compte (cf. syncQueue.clearSyncQueue).
 */

const KEY = "remote_index_v1";
const TOMBSTONE_TTL_MS = 24 * 60 * 60 * 1000;

type Persisted = { known: Record<string, number>; tombstones: Record<string, number> };

let known = new Map<string, number>();
let tombstones = new Map<string, number>();
const inFlight = new Map<string, number>();
let loaded = false;
let loading: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function rowKey(table: string, id: string): string {
  return `${table}\u0000${id}`;
}

export function loadRemoteIndex(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!loading) {
    loading = readJson<Persisted>(KEY, { known: {}, tombstones: {} })
      .then((data) => {
        // Des écritures ont pu arriver avant la fin de la lecture : on les
        // garde (elles sont plus récentes que le fichier).
        known = new Map([...Object.entries(data.known ?? {}), ...known]);
        const now = Date.now();
        const fresh = Object.entries(data.tombstones ?? {}).filter(([, at]) => now - at < TOMBSTONE_TTL_MS);
        tombstones = new Map([...fresh, ...tombstones]);
      })
      .catch(() => {})
      .finally(() => {
        loaded = true;
      });
  }
  return loading;
}

function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    writeJson(KEY, { known: Object.fromEntries(known), tombstones: Object.fromEntries(tombstones) }).catch(() => {});
  }, 500);
}

/** Une écriture part (upsert ou suppression) : la fusion la protège jusqu'à
 * sa conclusion. */
export function beginWrite(table: string, id: string): void {
  const key = rowKey(table, id);
  inFlight.set(key, (inFlight.get(key) ?? 0) + 1);
}

/** Fin d'envoi (réussi ou non) : la ligne n'est plus « en vol ». */
export function endWrite(table: string, id: string): void {
  const key = rowKey(table, id);
  const count = (inFlight.get(key) ?? 1) - 1;
  if (count <= 0) inFlight.delete(key);
  else inFlight.set(key, count);
}

/** Enveloppe une écriture : protégée par la fusion tant qu'elle est en vol. */
export async function withWriteTracking<R>(table: string, id: string, write: () => Promise<R>): Promise<R> {
  beginWrite(table, id);
  try {
    return await write();
  } finally {
    endWrite(table, id);
  }
}

/** Écriture acceptée par le serveur (directe ou rejouée depuis la file). */
export function recordWriteSuccess(table: string, id: string, deleted: boolean): void {
  const key = rowKey(table, id);
  const now = Date.now();
  if (deleted) {
    known.delete(key);
    tombstones.set(key, now);
  } else {
    known.set(key, now);
    tombstones.delete(key);
  }
  scheduleSave();
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
  /** La version locale fait autorité (en file, en vol, ou écrite après le
   * départ de la relecture). */
  isProtected: (id: string) => boolean;
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
      if (pendingIds.has(id) || inFlight.has(key)) return true;
      const at = known.get(key);
      return at !== undefined && at > pullStartedAt;
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

export async function clearRemoteIndex(): Promise<void> {
  known = new Map();
  tombstones = new Map();
  inFlight.clear();
  loaded = true;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await writeJson(KEY, { known: {}, tombstones: {} }).catch(() => {});
}

/** Tests uniquement : remet le module à zéro. */
export function __resetRemoteIndexForTests(): void {
  known = new Map();
  tombstones = new Map();
  inFlight.clear();
  loaded = true;
  loading = null;
}
