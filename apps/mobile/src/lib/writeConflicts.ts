/**
 * Conflit entre deux appareils : une modification faite hors ligne sur A, puis
 * renvoyée au retour du réseau, ne doit pas écraser une version plus récente
 * de la même ligne déjà enregistrée par B (cf. sync/shared.replayOperation).
 * La règle est « la modification la plus récente gagne » ; la version écartée
 * n'est pas perdue en silence : la bannière de l'Accueil le dit, et la ligne
 * affichée est celle du serveur à la relecture suivante.
 *
 * Avant (audit du 2026-11-11), le dernier ENVOI gagnait : A, revenu en ligne à
 * 12 h avec une modification faite à 9 h, écrasait celle de B faite à 10 h.
 */

import { parseServerDate } from "@/lib/serverDate";

/** Décalage d'horloge toléré entre deux appareils : au-delà, la version du
 * serveur est réellement plus récente. En deçà, on écrit — un faux conflit
 * ferait perdre une saisie légitime. */
const CLOCK_TOLERANCE_MS = 2 * 60 * 1000;

/** `rowUpdatedAt` : date de la modification rejouée ; `serverUpdatedAt` : date
 * de la ligne actuellement sur le serveur. Au moindre doute : pas périmée. */
export function isStaleWrite(rowUpdatedAt: unknown, serverUpdatedAt: unknown): boolean {
  if (typeof rowUpdatedAt !== "string" || typeof serverUpdatedAt !== "string") return false;
  // Le serveur renvoie des `timestamp` sans fuseau : lus comme de l'UTC, pas
  // comme l'heure de l'appareil (cf. serverDate.ts), sinon un décalage de 1 à
  // 2 h fausserait la comparaison.
  const mine = parseServerDate(rowUpdatedAt).getTime();
  const theirs = parseServerDate(serverUpdatedAt).getTime();
  if (!Number.isFinite(mine) || !Number.isFinite(theirs)) return false;
  return theirs - mine > CLOCK_TOLERANCE_MS;
}

const conflicts = new Set<string>();
const listeners = new Set<(count: number) => void>();

function notify() {
  for (const listener of listeners) listener(conflicts.size);
}

export function noteWriteConflict(table: string, id: string): void {
  const key = `${table}\u0000${id}`;
  if (conflicts.has(key)) return;
  conflicts.add(key);
  notify();
}

export function clearWriteConflicts(): void {
  conflicts.clear();
  notify();
}

export function writeConflictCount(): number {
  return conflicts.size;
}

export function subscribeToWriteConflicts(listener: (count: number) => void): () => void {
  listeners.add(listener);
  listener(conflicts.size);
  return () => void listeners.delete(listener);
}
