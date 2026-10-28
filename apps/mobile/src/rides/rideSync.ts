import type { SessionRide } from "@/rides/types";

/**
 * Fusion d'une relecture du serveur (cf. sessions/store.tsx mergeFromCloud) :
 * un parcours que le serveur ne connaît pas encore — `ride` undefined, la
 * table n'a pas pu être lue — n'est pas effacé. Un `null` explicite (lu, pas
 * de parcours) laisse la version du serveur, et la séance locale renvoie son
 * parcours (cf. mergeFromCloud).
 */
export function keepLocalRide<T extends { ride?: SessionRide | null }>(local: T, remote: T): T {
  if (remote.ride !== undefined || !local.ride) return remote;
  return { ...remote, ride: local.ride };
}

/** Relecture du fichier local : les dates y sont des chaînes. */
export function reviveRide(ride: SessionRide | null | undefined): SessionRide | null | undefined {
  return ride ? { ...ride, startedAt: new Date(ride.startedAt), endedAt: new Date(ride.endedAt) } : ride;
}
