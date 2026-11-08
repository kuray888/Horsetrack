import { supabase } from "@/lib/supabase";
import { parseServerDate, parseServerDateOrNull } from "@/lib/serverDate";
import { activityFromServer, activityToServer } from "@/agenda/activityKinds";
import type { RideSlot, SlotKind } from "@/planning/slots";
import { settleWrite } from "./shared";

/** Créneaux récurrents (cf. planning/slots.ts, rls.sql « creneaux »).
 * Écriture refusée par la base hors Écurie Pro : la file la garde comme
 * refus définitif, l'écran ne la propose de toute façon pas. */

export async function pushRideSlotImpl(slot: RideSlot, stamp?: number): Promise<void> {
  const row = {
    id: slot.id,
    horseId: slot.horseId,
    riderUserId: slot.riderUserId,
    riderName: slot.riderName,
    weekday: slot.weekday,
    startTime: slot.startTime,
    endTime: slot.endTime,
    validFrom: slot.validFrom.toISOString(),
    validUntil: slot.validUntil?.toISOString() ?? null,
    kind: slot.kind,
    activityType: slot.activityType ? activityToServer(slot.activityType).activityType : null,
    notes: slot.notes,
    updatedAt: slot.updatedAt,
  };
  const { error } = await supabase.from("ride_slots").upsert(row);
  await settleWrite("pushRideSlot", "ride_slots", slot.id, error, row, stamp);
}

export async function deleteRideSlotRemoteImpl(id: string, stamp?: number): Promise<void> {
  const { error } = await supabase.from("ride_slots").delete().eq("id", id);
  await settleWrite("deleteRideSlotRemote", "ride_slots", id, error, undefined, stamp);
}

type SlotRow = {
  id: string;
  horseId: string;
  riderUserId: string | null;
  riderName: string | null;
  weekday: number;
  startTime: string | null;
  endTime: string | null;
  validFrom: string;
  validUntil: string | null;
  kind: string;
  activityType: string | null;
  notes: string;
  updatedAt: string;
};

/** Créneaux visibles (chevaux possédés et partagés) ; null si la lecture
 * échoue, table absente comprise (base pas encore migrée). */
export async function pullRideSlots(): Promise<RideSlot[] | null> {
  const { data, error } = await supabase
    .from("ride_slots")
    .select("id, horseId, riderUserId, riderName, weekday, startTime, endTime, validFrom, validUntil, kind, activityType, notes, updatedAt");
  if (error || !data) return null;
  return (data as SlotRow[]).map((row) => ({
    id: row.id,
    horseId: row.horseId,
    riderUserId: row.riderUserId ?? null,
    riderName: row.riderName ?? null,
    weekday: row.weekday,
    startTime: row.startTime ?? null,
    endTime: row.endTime ?? null,
    validFrom: parseServerDate(row.validFrom),
    validUntil: parseServerDateOrNull(row.validUntil),
    kind: (["DP", "LESSON", "WORK"].includes(row.kind) ? row.kind : "WORK") as SlotKind,
    activityType: row.activityType ? activityFromServer(row.activityType) : null,
    notes: row.notes ?? "",
    updatedAt: parseServerDate(row.updatedAt).toISOString(),
  }));
}

/** Jours de demi-pension → créneaux (propriétaire en Écurie Pro), cf.
 * rls.sql migrate_partnership_slots. Renvoie le nombre de créneaux créés, ou
 * null en cas d'échec (hors ligne, pas Pro, base pas migrée). */
export async function migratePartnershipSlots(horseId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc("migrate_partnership_slots", { _horse_id: horseId });
  if (error || typeof data !== "number") return null;
  return data;
}
