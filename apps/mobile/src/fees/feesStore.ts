import { useSyncExternalStore } from "react";
import { readJsonChecked, removeJson, writeJson } from "@/lib/localStore";
import { pendingIdsFor } from "@/lib/syncQueue";
import { deleteFeeRemote, pullFees, pushFee } from "@/lib/cloudSync";
import { mergeByUpdatedAt } from "@/extras/model";
import { feeId, type Fee } from "@/fees/feesModel";

/**
 * Participation aux frais : sur le téléphone d'abord, envoyée au serveur à
 * chaque modification (reprise par la file de synchro), relue avec le reste
 * (cf. lib/cloudRefresh.tsx). Même construction que planning/slotsStore.ts.
 * Suivi seulement : aucun argent ne transite par l'app.
 */

const KEY = "participation_fees_v1";
type Stored = Omit<Fee, "paidAt"> & { paidAt: string | null };

let fees: Fee[] = [];
let loaded = false;
let loadFailed = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

function persist() {
  if (!loaded || loadFailed) return;
  void writeJson(KEY, fees.map((f): Stored => ({ ...f, paidAt: f.paidAt?.toISOString() ?? null })));
}

function setFees(next: Fee[]) {
  fees = next;
  persist();
  emit();
}

export function loadFees(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    const { ok, value } = await readJsonChecked<Stored[] | null>(KEY, null);
    if (!ok) loadFailed = true;
    if (Array.isArray(value)) fees = value.map((f) => ({ ...f, paidAt: f.paidAt ? new Date(f.paidAt) : null }));
    loaded = true;
    emit();
  })();
  return loading;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  void loadFees();
  return () => listeners.delete(listener);
}

const getFees = () => fees;

export function useFees(): Fee[] {
  return useSyncExternalStore(subscribe, getFees, getFees);
}

export function saveFee(input: Pick<Fee, "horseId" | "payerUserId" | "payerName" | "month" | "amount"> & Partial<Pick<Fee, "paidAt" | "notes">>): Fee {
  const id = feeId(input.horseId, input.payerUserId, input.payerName, input.month);
  const existing = fees.find((f) => f.id === id);
  const fee: Fee = { notes: "", paidAt: null, ...existing, ...input, id, updatedAt: new Date().toISOString() };
  setFees(existing ? fees.map((f) => (f.id === id ? fee : f)) : [...fees, fee]);
  pushFee(fee).catch(() => {});
  return fee;
}

export function setFeePaid(id: string, paid: boolean): void {
  const fee = fees.find((f) => f.id === id);
  if (!fee) return;
  saveFee({ ...fee, paidAt: paid ? new Date() : null });
}

export function deleteFee(id: string): void {
  setFees(fees.filter((f) => f.id !== id));
  deleteFeeRemote(id).catch(() => {});
}

export async function refreshFees(pullStartedAt: number): Promise<void> {
  await loadFees();
  if (loadFailed) return;
  const remote = await pullFees().catch(() => null);
  if (!remote) return;
  setFees(mergeByUpdatedAt(fees, remote, (f) => f.id, pendingIdsFor("participation_fees"), pullStartedAt));
}

/** Déconnexion, suppression du compte, changement de compte. */
export async function clearFees(): Promise<void> {
  fees = [];
  await removeJson(KEY);
  emit();
}
