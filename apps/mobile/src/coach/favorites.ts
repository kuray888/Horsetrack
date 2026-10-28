import { useSyncExternalStore } from "react";
import { readJson, writeJson } from "@/lib/localStore";

/**
 * Exercices favoris de la bibliothèque : une préférence de l'appareil,
 * gardée sur le téléphone (pas une donnée du cheval, rien à partager).
 */

const KEY = "exercise_favorites_v1";
let favorites: ReadonlySet<string> = new Set();
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function load() {
  if (loaded) return;
  loaded = true;
  readJson<string[]>(KEY, [])
    .then((ids) => {
      if (Array.isArray(ids)) {
        favorites = new Set([...ids, ...favorites]);
        emit();
      }
    })
    .catch(() => {});
}

export function toggleFavorite(id: string): boolean {
  const next = new Set(favorites);
  const added = !next.has(id);
  if (added) next.add(id);
  else next.delete(id);
  favorites = next;
  void writeJson(KEY, [...next]);
  emit();
  return added;
}

function subscribe(l: () => void) {
  listeners.add(l);
  load();
  return () => listeners.delete(l);
}

const get = () => favorites;

export function useFavorites(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, get, get);
}
