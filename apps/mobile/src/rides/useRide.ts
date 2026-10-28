import { useEffect, useState, useSyncExternalStore } from "react";
import { getRideDraft, subscribeRide } from "@/rides/recorder";
import { getSafetyState, subscribeSafety } from "@/rides/safety";

/** Séance en cours (ou null), mise à jour à chaque point GPS et changement d'état. */
export function useRideDraft() {
  return useSyncExternalStore(subscribeRide, getRideDraft, getRideDraft);
}

export function useSafetyState() {
  return useSyncExternalStore(subscribeSafety, getSafetyState, getSafetyState);
}

/** Horloge qui avance chaque seconde tant que `active` — pour le chrono. */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}
