/**
 * Écritures REFUSÉES par le serveur (RLS, clé étrangère… cf.
 * syncQueue.isPermanentError) — distinctes de celles qui attendent le réseau
 * (cf. syncQueue, bannière « attend la sauvegarde en ligne »).
 *
 * Jusqu'ici un refus ne laissait aucune trace hors des logs : l'app affichait
 * « Séance enregistrée » alors que le serveur n'en voulait pas, et rien ne le
 * disait (cf. audit du 2026-09-30, compte « Premium offert » vu gratuit par le
 * serveur). Ce registre alimente une bannière sur l'écran Aujourd'hui.
 *
 * En mémoire seulement : chaque relecture du serveur repart de zéro (cf.
 * lib/cloudRefresh.tsx) et renvoie ce qui n'est jamais arrivé (cf.
 * mergeRemote.unsyncedLocalIds) — un refus toujours d'actualité y est noté à
 * nouveau, un refus levé entre-temps disparaît.
 */

const rejected = new Set<string>();
const listeners = new Set<(count: number) => void>();

function key(table: string, id: string): string {
  return `${table}\u0000${id}`;
}

function notify() {
  for (const listener of listeners) listener(rejected.size);
}

export function noteRejectedWrite(table: string, id: string): void {
  const k = key(table, id);
  if (rejected.has(k)) return;
  rejected.add(k);
  notify();
}

/** La ligne vient d'être acceptée par le serveur. */
export function clearRejectedWrite(table: string, id: string): void {
  if (rejected.delete(key(table, id))) notify();
}

/** Nouvelle relecture, ou changement de compte. */
export function clearRejectedWrites(): void {
  if (rejected.size === 0) return;
  rejected.clear();
  notify();
}

export function rejectedWriteCount(): number {
  return rejected.size;
}

export function subscribeToRejectedWrites(listener: (count: number) => void): () => void {
  listeners.add(listener);
  listener(rejected.size);
  return () => void listeners.delete(listener);
}
