import { useEffect, useState } from "react";
import { rejectedWriteCount, subscribeToRejectedWrites } from "@/lib/rejectedWrites";
import { subscribeToWriteConflicts, writeConflictCount } from "@/lib/writeConflicts";
import { pendingSyncCount, subscribeToSyncQueue } from "@/lib/syncQueue";

/** Nombre d'écritures cloud en attente de reprise (cf. lib/syncQueue.ts).
 *
 * Branchement React du module, volontairement séparé de lui pour que la file
 * reste testable sans rendu — même découpage que useSelectableHorses. Permet
 * de dire ce qui n'est PAS encore sauvegardé dans le cloud, plutôt que de
 * laisser croire que tout l'est. */
export function usePendingSyncCount(): number {
  const [pending, setPending] = useState(pendingSyncCount);
  useEffect(() => subscribeToSyncQueue(setPending), []);
  return pending;
}

/** Nombre d'écritures refusées par le serveur (cf. lib/rejectedWrites.ts). */
export function useRejectedWriteCount(): number {
  const [count, setCount] = useState(rejectedWriteCount);
  useEffect(() => subscribeToRejectedWrites(setCount), []);
  return count;
}

/** Modifications faites hors ligne remplacées par une version plus récente
 * faite sur un autre appareil (cf. lib/writeConflicts.ts). */
export function useWriteConflictCount(): number {
  const [count, setCount] = useState(writeConflictCount);
  useEffect(() => subscribeToWriteConflicts(setCount), []);
  return count;
}
