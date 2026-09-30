import { useEffect, useState } from "react";
import { rejectedWriteCount, subscribeToRejectedWrites } from "@/lib/rejectedWrites";
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
