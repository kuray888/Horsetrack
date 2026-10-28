import { useSyncExternalStore } from "react";
import { readJsonChecked, removeJson, writeJson } from "@/lib/localStore";
import { pendingIdsFor } from "@/lib/syncQueue";
import { deleteContactRemote, pullContacts, pullHorseDetails, pushContact, pushHorseDetails } from "@/lib/cloudSync";
import { t } from "@/i18n";
import {
  mergeByUpdatedAt,
  normalizeDetails,
  type Contact,
  type FeedingPlan,
  type HorseDetails,
  type HorseIdentity,
  type Partnership,
} from "@/extras/model";

/**
 * Identité et alimentation des chevaux, carnet de contacts : stockés sur le
 * téléphone d'abord (fichier JSON), envoyés au serveur à chaque modification
 * (avec reprise par la file de synchro en cas d'échec), relus avec le reste
 * des données (cf. lib/cloudRefresh.tsx → refreshExtras).
 *
 * Hors de React, comme l'enregistreur de séance : peu de données, et aucun
 * écran n'a besoin d'un fournisseur de plus autour de l'app.
 */

const KEY = "extras_v1";

type State = { details: Record<string, HorseDetails>; contacts: Contact[] };

let state: State = { details: {}, contacts: [] };
let loaded = false;
let loadFailed = false;
const listeners = new Set<() => void>();

const defaultMeals = (): [string, string, string] => [t("Matin"), t("Midi"), t("Soir")];

function emit() {
  for (const l of listeners) l();
}

function persist() {
  if (!loaded || loadFailed) return;
  void writeJson(KEY, state);
}

function setState(next: State) {
  state = next;
  persist();
  emit();
}

let loading: Promise<void> | null = null;

export function loadExtras(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    const { ok, value } = await readJsonChecked<State | null>(KEY, null);
    // Lecture ratée : on n'écrira pas par-dessus le fichier existant.
    if (!ok) loadFailed = true;
    if (value) {
      state = {
        details: Object.fromEntries(
          Object.entries(value.details ?? {}).map(([id, d]) => [id, normalizeDetails(id, d, defaultMeals())])
        ),
        contacts: Array.isArray(value.contacts) ? value.contacts : [],
      };
    }
    loaded = true;
    emit();
  })();
  return loading;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  void loadExtras();
  return () => listeners.delete(listener);
}

const getState = () => state;

export function useExtras(): State {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function useHorseDetails(horseId: string | undefined): HorseDetails | null {
  const s = useExtras();
  if (!horseId) return null;
  return s.details[horseId] ?? normalizeDetails(horseId, null, defaultMeals());
}

export function useContacts(): Contact[] {
  return useExtras().contacts;
}

// --- Écritures ---------------------------------------------------------------

export function saveHorseDetails(
  horseId: string,
  patch: { identity?: HorseIdentity; feeding?: FeedingPlan; partnership?: Partnership }
): void {
  const current = state.details[horseId] ?? normalizeDetails(horseId, null, defaultMeals());
  const next: HorseDetails = { ...current, ...patch, updatedAt: new Date().toISOString() };
  setState({ ...state, details: { ...state.details, [horseId]: next } });
  pushHorseDetails(next).catch(() => {});
}

function generateId(): string {
  return `ct${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function saveContact(input: Omit<Contact, "id" | "updatedAt"> & { id?: string }): Contact {
  const contact: Contact = { ...input, id: input.id ?? generateId(), updatedAt: new Date().toISOString() };
  const exists = state.contacts.some((c) => c.id === contact.id);
  setState({
    ...state,
    contacts: exists ? state.contacts.map((c) => (c.id === contact.id ? contact : c)) : [...state.contacts, contact],
  });
  pushContact(contact).catch(() => {});
  return contact;
}

export function deleteContact(id: string): void {
  setState({ ...state, contacts: state.contacts.filter((c) => c.id !== id) });
  deleteContactRemote(id).catch(() => {});
}

/** Cheval supprimé de l'écurie : sa fiche part avec lui (cascade côté serveur). */
export function removeHorseExtras(horseId: string): void {
  if (!state.details[horseId]) return;
  const { [horseId]: _removed, ...rest } = state.details;
  setState({ ...state, details: rest });
}

// --- Relecture du serveur ------------------------------------------------------

export async function refreshExtras(pullStartedAt: number): Promise<void> {
  await loadExtras();
  if (loadFailed) return;
  const [details, contacts] = await Promise.all([
    pullHorseDetails().catch(() => null),
    pullContacts().catch(() => null),
  ]);
  let next = state;
  if (details) {
    const remote = details.map((d) => normalizeDetails(d.horseId, d, defaultMeals()));
    const merged = mergeByUpdatedAt(
      Object.values(state.details),
      remote,
      (d) => d.horseId,
      pendingIdsFor("horse_details"),
      pullStartedAt,
      true
    );
    next = { ...next, details: Object.fromEntries(merged.map((d) => [d.horseId, d])) };
  }
  if (contacts) {
    next = {
      ...next,
      contacts: mergeByUpdatedAt(state.contacts, contacts, (c) => c.id, pendingIdsFor("rider_contacts"), pullStartedAt),
    };
  }
  if (next !== state) setState(next);
}

/** Déconnexion, suppression du compte, changement de compte. */
export async function clearExtras(): Promise<void> {
  state = { details: {}, contacts: [] };
  await removeJson(KEY);
  emit();
}
