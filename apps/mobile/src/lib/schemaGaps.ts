import { readJson, writeJson } from "@/lib/localStore";

/**
 * Colonnes ajoutées après coup (activityKind, videoPath…), lues par
 * selectWithOptionalColumns (cf. lib/cloudSync.ts).
 *
 * Tant que le SQL n'est pas exécuté, la colonne manque : l'écriture part sans
 * elle et la relecture ne la renvoie pas. Une fois le SQL exécuté, les lignes
 * écrites entre-temps ont la colonne vide : sans rattrapage, la relecture
 * suivante remplaçait le type précis (« TREC ») par le type de base
 * (« Balade ») et effaçait la vidéo d'un souvenir.
 *
 * Ce module retient sur le téléphone les colonnes vues absentes. À la
 * première relecture où elles existent (« catching_up »), la version locale
 * est gardée et renvoyée une fois (cf. agenda/activityKinds.ts
 * mergeActivityType, agenda/journalMedia.ts mergeJournalVideo), puis l'écart
 * est oublié (columnCaughtUp).
 */

export type ColumnState = "missing" | "catching_up" | "present";

const KEY = "schema_gaps_v1";

/** « table.colonne » vues absentes, pas encore rattrapées. */
let gaps = new Set<string>();
let loading: Promise<void> | null = null;
/** Résultat de la dernière relecture : la colonne était-elle là ? */
const lastRead = new Map<string, boolean>();

const keyOf = (table: string, column: string) => `${table}.${column}`;

function load(): Promise<void> {
  loading ??= readJson<string[]>(KEY, [])
    .then((saved) => {
      if (Array.isArray(saved)) for (const k of saved) gaps.add(k);
    })
    .catch(() => {});
  return loading;
}

function persist() {
  void writeJson(KEY, [...gaps]);
}

/** Appelé par chaque lecture à colonnes facultatives. */
export async function noteColumnsRead(table: string, columns: string[], present: boolean): Promise<void> {
  await load();
  let changed = false;
  for (const column of columns) {
    const k = keyOf(table, column);
    lastRead.set(k, present);
    if (!present && !gaps.has(k)) {
      gaps.add(k);
      changed = true;
    }
  }
  if (changed) persist();
}

export function columnState(table: string, column: string): ColumnState {
  const k = keyOf(table, column);
  const present = lastRead.get(k);
  if (present === false) return "missing";
  if (present === true && gaps.has(k)) return "catching_up";
  return "present";
}

/** Les lignes concernées sont reparties (ou attendent dans la file de synchro). */
export function columnCaughtUp(table: string, column: string): void {
  if (!gaps.delete(keyOf(table, column))) return;
  persist();
}

/** Tests uniquement. */
export function resetSchemaGapsForTests(): void {
  gaps = new Set();
  loading = null;
  lastRead.clear();
}
