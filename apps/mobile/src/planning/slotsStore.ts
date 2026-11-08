import { useSyncExternalStore } from "react";
import { readJsonChecked, removeJson, writeJson } from "@/lib/localStore";
import { pendingIdsFor } from "@/lib/syncQueue";
import { deleteRideSlotRemote, migratePartnershipSlots, pullRideSlots, pushRideSlot } from "@/lib/cloudSync";
import { mergeByUpdatedAt } from "@/extras/model";
import type { RideSlot } from "@/planning/slots";

/**
 * Créneaux récurrents : sur le téléphone d'abord (fichier JSON), envoyés au
 * serveur à chaque modification (reprise par la file de synchro), relus
 * avec le reste des données (cf. lib/cloudRefresh.tsx → refreshSlots). Même
 * construction que extras/store.ts : peu de données, pas de fournisseur.
 */

const KEY = "ride_slots_v1";

type Stored = Omit<RideSlot, "validFrom" | "validUntil"> & { validFrom: string; validUntil: string | null };

let slots: RideSlot[] = [];
let loaded = false;
let loadFailed = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  if (!loaded || loadFailed) return;
  const stored: Stored[] = slots.map((s) => ({
    ...s,
    validFrom: s.validFrom.toISOString(),
    validUntil: s.validUntil?.toISOString() ?? null,
  }));
  void writeJson(KEY, stored);
}

function setSlots(next: RideSlot[]) {
  slots = next;
  persist();
  emit();
}

export function loadSlots(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    const { ok, value } = await readJsonChecked<Stored[] | null>(KEY, null);
    if (!ok) loadFailed = true;
    if (Array.isArray(value)) {
      slots = value.map((s) => ({
        ...s,
        validFrom: new Date(s.validFrom),
        validUntil: s.validUntil ? new Date(s.validUntil) : null,
      }));
    }
    loaded = true;
    emit();
  })();
  return loading;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  void loadSlots();
  return () => listeners.delete(listener);
}

const getSlots = () => slots;

/** Tous les créneaux connus (chevaux possédés et partagés). */
export function useSlots(): RideSlot[] {
  return useSyncExternalStore(subscribe, getSlots, getSlots);
}

// --- Écritures ---------------------------------------------------------------

function generateId(): string {
  return `sl${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function saveSlot(input: Omit<RideSlot, "id" | "updatedAt"> & { id?: string }): RideSlot {
  const slot: RideSlot = { ...input, id: input.id ?? generateId(), updatedAt: new Date().toISOString() };
  const exists = slots.some((s) => s.id === slot.id);
  setSlots(exists ? slots.map((s) => (s.id === slot.id ? slot : s)) : [...slots, slot]);
  pushRideSlot(slot).catch(() => {});
  return slot;
}

/** Arrête un créneau à partir d'aujourd'hui : les séances passées gardent
 * leur lien, l'historique reste juste. */
export function endSlot(id: string, lastDay: Date): void {
  const slot = slots.find((s) => s.id === id);
  if (!slot) return;
  // Créneau qui n'a encore jamais eu lieu : supprimé plutôt qu'arrêté.
  if (slot.validFrom.getTime() > lastDay.getTime()) {
    setSlots(slots.filter((s) => s.id !== id));
    deleteRideSlotRemote(id).catch(() => {});
    return;
  }
  saveSlot({ ...slot, validUntil: lastDay });
}

// --- Relecture du serveur ------------------------------------------------------

export async function refreshSlots(pullStartedAt: number): Promise<void> {
  await loadSlots();
  if (loadFailed) return;
  const remote = await pullRideSlots().catch(() => null);
  if (!remote) return;
  setSlots(mergeByUpdatedAt(slots, remote, (s) => s.id, pendingIdsFor("ride_slots"), pullStartedAt));
}

/** Jours de demi-pension de la fiche → créneaux, puis relecture. */
export async function migrateHorsePartnership(horseId: string): Promise<number> {
  const created = await migratePartnershipSlots(horseId);
  if (created) await refreshSlots(Date.now());
  return created ?? 0;
}

/** Déconnexion, suppression du compte, changement de compte. */
export async function clearSlots(): Promise<void> {
  slots = [];
  await removeJson(KEY);
  emit();
}
