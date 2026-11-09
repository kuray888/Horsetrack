import { supabase } from "@/lib/supabase";
import { parseServerDate, parseServerDateOrNull } from "@/lib/serverDate";
import type { Fee } from "@/fees/feesModel";
import { settleWrite } from "./shared";

/** Participation aux frais (cf. fees/feesModel.ts, rls.sql « participation-frais »).
 * Écriture refusée par la base hors Écurie Pro : la file la garde comme refus définitif. */

export async function pushFeeImpl(fee: Fee, stamp?: number): Promise<void> {
  const row = {
    id: fee.id,
    horseId: fee.horseId,
    payerUserId: fee.payerUserId,
    payerName: fee.payerName,
    month: fee.month,
    amount: fee.amount,
    paidAt: fee.paidAt?.toISOString() ?? null,
    notes: fee.notes,
    updatedAt: fee.updatedAt,
  };
  const { error } = await supabase.from("participation_fees").upsert(row);
  await settleWrite("pushFee", "participation_fees", fee.id, error, row, stamp);
}

export async function deleteFeeRemoteImpl(id: string, stamp?: number): Promise<void> {
  const { error } = await supabase.from("participation_fees").delete().eq("id", id);
  await settleWrite("deleteFeeRemote", "participation_fees", id, error, undefined, stamp);
}

type FeeRow = {
  id: string;
  horseId: string;
  payerUserId: string | null;
  payerName: string | null;
  month: string;
  amount: number | string;
  paidAt: string | null;
  notes: string;
  updatedAt: string;
};

/** Lignes visibles : toutes pour le propriétaire et le gérant, les siennes
 * pour un payeur ; null si la lecture échoue (table absente comprise). */
export async function pullFees(): Promise<Fee[] | null> {
  const { data, error } = await supabase
    .from("participation_fees")
    .select("id, horseId, payerUserId, payerName, month, amount, paidAt, notes, updatedAt");
  if (error || !data) return null;
  return (data as FeeRow[]).map((r) => ({
    id: r.id,
    horseId: r.horseId,
    payerUserId: r.payerUserId ?? null,
    payerName: r.payerName ?? null,
    month: r.month,
    amount: Number(r.amount),
    paidAt: parseServerDateOrNull(r.paidAt),
    notes: r.notes ?? "",
    updatedAt: parseServerDate(r.updatedAt).toISOString(),
  }));
}
