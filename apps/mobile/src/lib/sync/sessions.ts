import { supabase } from "@/lib/supabase";
import { parseServerDate } from "@/lib/serverDate";
import type { TrainingSession } from "@/sessions/store";
import type { SessionRide } from "@/rides/types";
import { activityFromServer, activityToServer } from "@/agenda/activityKinds";
import { selectWithOptionalColumns, settleWrite, upsertWithOptionalColumns } from "./shared";

/** Séances d'entraînement et tracés GPS.
 * Extrait de lib/cloudSync.ts (façade) sans changement de comportement. */

export async function pushTrainingSessionImpl(session: TrainingSession, stamp?: number): Promise<void> {
  if (!session.horseId) return;
  const row = {
    id: session.id,
    horseId: session.horseId,
    ...activityToServer(session.activityType),
    customActivityLabel: session.customActivityLabel,
    date: session.date.toISOString(),
    time: session.time,
    durationMinutes: session.durationMinutes,
    intensity: session.intensity,
    notes: session.notes,
    completed: session.completed,
    // Cavalier et ressenti : envoyés seulement s'ils sont connus localement,
    // pour qu'une copie d'avant leur arrivée n'efface pas une attribution
    // faite ailleurs. Qui a coché et quand : posés par la base.
    ...(session.riderUserId !== undefined ? { riderUserId: session.riderUserId } : {}),
    ...(session.riderName !== undefined ? { riderName: session.riderName } : {}),
    ...(session.feeling !== undefined ? { feeling: session.feeling } : {}),
    ...(session.slotId !== undefined ? { slotId: session.slotId } : {}),
    ...(session.cancelledAt !== undefined ? { cancelledAt: session.cancelledAt?.toISOString() ?? null } : {}),
    updatedAt: new Date().toISOString(),
  };
  await upsertWithOptionalColumns(
    "pushTrainingSession",
    "training_sessions",
    session.id,
    row,
    ["activityKind", "riderUserId", "riderName", "feeling", "slotId", "cancelledAt"],
    stamp
  );
}
export async function deleteTrainingSessionRemoteImpl(sessionId: string, stamp?: number): Promise<void> {
  const { error } = await supabase.from("training_sessions").delete().eq("id", sessionId);
  await settleWrite("deleteTrainingSessionRemote", "training_sessions", sessionId, error, undefined, stamp);
}
/**
 * Parcours d'une séance enregistrée en direct — table à part
 * (training_session_rides), pour que la synchro des séances ne dépende jamais
 * de celle des parcours : tant que la table manque (SQL pas encore exécuté),
 * l'écriture échoue et attend dans la file, la séance, elle, est arrivée.
 */
export async function pushSessionRideImpl(sessionId: string, horseId: string, ride: SessionRide, stamp?: number): Promise<void> {
  const row = {
    id: sessionId,
    sessionId,
    horseId,
    startedAt: ride.startedAt.toISOString(),
    endedAt: ride.endedAt.toISOString(),
    durationSeconds: ride.durationSeconds,
    distanceMeters: ride.distanceMeters,
    walkSeconds: ride.walkSeconds,
    trotSeconds: ride.trotSeconds,
    canterSeconds: ride.canterSeconds,
    haltSeconds: ride.haltSeconds,
    maxSpeedKmh: ride.maxSpeedKmh,
    avgSpeedKmh: ride.avgSpeedKmh,
    gps: ride.gps,
    route: ride.route,
    updatedAt: new Date().toISOString(),
  };
  const { error } = await supabase.from("training_session_rides").upsert(row);
  await settleWrite("pushSessionRide", "training_session_rides", sessionId, error, row, stamp);
}
type RideRow = {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  distanceMeters: number;
  walkSeconds: number;
  trotSeconds: number;
  canterSeconds: number;
  haltSeconds: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  gps: boolean;
  route: string | null;
};
/** Parcours visibles (mêmes règles de partage que les séances), par séance ;
 * null si la lecture échoue (table absente comprise). */
async function pullSessionRides(): Promise<Map<string, SessionRide> | null> {
  const { data, error } = await supabase
    .from("training_session_rides")
    .select(
      "sessionId, startedAt, endedAt, durationSeconds, distanceMeters, walkSeconds, trotSeconds, canterSeconds, haltSeconds, maxSpeedKmh, avgSpeedKmh, gps, route"
    );
  if (error || !data) return null;
  return new Map(
    (data as RideRow[]).map((row) => [
      row.sessionId,
      {
        startedAt: new Date(row.startedAt),
        endedAt: new Date(row.endedAt),
        durationSeconds: row.durationSeconds,
        distanceMeters: row.distanceMeters,
        walkSeconds: row.walkSeconds,
        trotSeconds: row.trotSeconds,
        canterSeconds: row.canterSeconds,
        haltSeconds: row.haltSeconds,
        maxSpeedKmh: row.maxSpeedKmh,
        avgSpeedKmh: row.avgSpeedKmh,
        gps: row.gps,
        route: row.route ?? null,
      },
    ])
  );
}
/** Restaure les séances visibles par l'utilisateur courant — possédées ET
 * partagées (géré entièrement par RLS, cf. pullAppointments ci-dessus).
 * Chaque séance porte son parcours (`ride`) : null s'il n'y en a pas,
 * undefined si les parcours n'ont pas pu être lus (cf. keepLocalRide). */
type SessionRow = {
  id: string;
  horseId: string;
  activityType: string;
  activityKind?: string | null;
  customActivityLabel: string | null;
  date: string;
  time: string;
  durationMinutes: number | null;
  intensity: string | null;
  notes: string;
  completed: boolean;
  createdByUserId?: string | null;
  riderUserId?: string | null;
  riderName?: string | null;
  doneByUserId?: string | null;
  doneAt?: string | null;
  feeling?: string | null;
  slotId?: string | null;
  cancelledAt?: string | null;
};
export async function pullTrainingSessions(): Promise<TrainingSession[] | null> {
  const [data, rides] = await Promise.all([
    selectWithOptionalColumns<SessionRow>(
      "training_sessions",
      "id, horseId, activityType, customActivityLabel, date, time, durationMinutes, intensity, notes, completed",
      ["activityKind", "createdByUserId", "riderUserId", "riderName", "doneByUserId", "doneAt", "feeling", "slotId", "cancelledAt"]
    ),
    pullSessionRides().catch(() => null),
  ]);
  if (!data) return null;
  return data.map((row) => ({
    ride: rides ? (rides.get(row.id) ?? null) : undefined,
    id: row.id,
    horseId: row.horseId,
    activityType: activityFromServer(row.activityType, row.activityKind),
    customActivityLabel: row.customActivityLabel ?? null,
    date: parseServerDate(row.date),
    time: row.time,
    durationMinutes: row.durationMinutes ?? null,
    intensity: (row.intensity as TrainingSession["intensity"]) ?? null,
    notes: row.notes,
    completed: row.completed,
    // undefined si la colonne manque (base pas encore migrée) : cf. lib/permissions.ts isMine.
    createdByUserId: row.createdByUserId,
    riderUserId: row.riderUserId,
    riderName: row.riderName,
    doneByUserId: row.doneByUserId,
    doneAt: row.doneAt === undefined ? undefined : row.doneAt ? parseServerDate(row.doneAt) : null,
    feeling: row.feeling === undefined ? undefined : ((row.feeling as TrainingSession["feeling"]) ?? null),
    slotId: row.slotId,
    cancelledAt: row.cancelledAt === undefined ? undefined : row.cancelledAt ? parseServerDate(row.cancelledAt) : null,
  }));
}

/**
 * Suivi de poids : même portée de partage que training_sessions ci-dessus
 * (horseId, RLS can_access_horse) — audit produit post-V1, cf.
 * horses/weightStore.tsx.
 */
