/**
 * Séance en direct, à partir de la 1.3.0 (décision du 2026-11-13) : réservée à
 * Premium pour les NOUVEAUX comptes, la première offerte. Les comptes qui
 * existaient avant gardent tout (rider_profiles.liveRideFree, posé par la
 * migration ; absent tant que la base n'est pas migrée = comme avant). Le
 * serveur applique la même règle (rls.sql, horse_owner_can_live_ride). Une
 * séance déjà commencée n'est jamais bloquée (cf. app/ride.tsx).
 * Logique pure, testée dans liveRideAccess.test.ts.
 */
export type LiveRideAccess = "allowed" | "first_free" | "locked";

export function liveRideAccess(input: {
  isPremium: boolean;
  liveRideFree: boolean | null | undefined;
  ownRides: number;
}): LiveRideAccess {
  if (input.isPremium || input.liveRideFree !== false) return "allowed";
  return input.ownRides === 0 ? "first_free" : "locked";
}

/** Parcours enregistrés sur ses propres chevaux (même décompte que le serveur). */
export function countOwnRides(sessions: { horseId: string | null; ride?: unknown }[], ownedHorseIds: Set<string>): number {
  return sessions.filter((s) => s.ride && s.horseId !== null && ownedHorseIds.has(s.horseId)).length;
}
