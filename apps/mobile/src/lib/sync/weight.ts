import { supabase } from "@/lib/supabase";
import { parseServerDate } from "@/lib/serverDate";
import type { WeightMeasurement } from "@/horses/weightStore";
import { selectWithOptionalColumns, settleWrite } from "./shared";

/** Mesures de poids.
 * Extrait de lib/cloudSync.ts (façade) sans changement de comportement. */

export async function pushWeightMeasurementImpl(measurement: WeightMeasurement, stamp?: number): Promise<void> {
  const row = {
    id: measurement.id,
    horseId: measurement.horseId,
    weightKg: measurement.weightKg,
    date: measurement.date.toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const { error } = await supabase.from("horse_weight_measurements").upsert(row);
  await settleWrite("pushWeightMeasurement", "horse_weight_measurements", measurement.id, error, row, stamp);
}
export async function deleteWeightMeasurementRemoteImpl(id: string, stamp?: number): Promise<void> {
  const { error } = await supabase.from("horse_weight_measurements").delete().eq("id", id);
  await settleWrite("deleteWeightMeasurementRemote", "horse_weight_measurements", id, error, undefined, stamp);
}
export async function pullWeightMeasurements(): Promise<WeightMeasurement[] | null> {
  const data = await selectWithOptionalColumns<{
    id: string;
    horseId: string;
    weightKg: number;
    date: string;
    createdByUserId?: string | null;
  }>("horse_weight_measurements", "id, horseId, weightKg, date", ["createdByUserId"]);
  if (!data) return null;
  return data.map((row) => ({
    id: row.id,
    horseId: row.horseId,
    weightKg: row.weightKg,
    date: parseServerDate(row.date),
    createdByUserId: row.createdByUserId,
  }));
}

/**
 * Dépenses : même portée de partage que training_sessions ci-dessus
 * (horseId, RLS can_access_horse) — synchronisées une à une comme les
 * documents/épreuves (cf. pushDocument/pushCompetitionEntry), pas de
 * remplacement en masse.
 */
