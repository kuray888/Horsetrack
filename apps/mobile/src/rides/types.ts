/**
 * Parcours d'une séance enregistrée en direct — rattaché à sa séance
 * (TrainingSession.ride), synchronisé dans la table training_session_rides
 * (cf. packages/db/prisma/seances-en-direct-2026-10-27.sql).
 */
export type SessionRide = {
  startedAt: Date;
  endedAt: Date;
  /** Hors pauses. */
  durationSeconds: number;
  distanceMeters: number;
  walkSeconds: number;
  trotSeconds: number;
  canterSeconds: number;
  haltSeconds: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  /** Faux pour une séance chronométrée sans GPS (manège couvert). */
  gps: boolean;
  /** Polyligne encodée (cf. rideMath.encodePolyline), null sans GPS. */
  route: string | null;
};
