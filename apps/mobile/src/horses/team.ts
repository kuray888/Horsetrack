import { useCallback, useMemo, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { readJson, removeJson, writeJson } from "@/lib/localStore";
import type { HorseRole } from "@/lib/permissions";
import type { TeamMember } from "@/planning/riders";

/**
 * Équipe d'un cheval (propriétaire + collaborateurs acceptés, avec un nom
 * affichable), lue par la fonction serveur horse_team (cf. rls.sql
 * planning-seances). Gardée sur l'appareil pour s'afficher hors ligne, et
 * relue une fois par lancement. Une liste vide tant que rien n'est connu.
 * Ce sont des noms d'autres personnes : vidée à la suppression du compte et
 * au changement de compte (clearHorseTeams).
 */

const KEY = "horse_teams_v1";
const memory = new Map<string, TeamMember[]>();
const fetched = new Set<string>();
const listeners = new Map<string, Set<() => void>>();
const EMPTY: TeamMember[] = [];

/** Change à chaque nouvelle équipe connue (cf. useHorseTeams). */
let version = 0;
const anyListeners = new Set<() => void>();

function publish(horseId: string, team: TeamMember[]) {
  memory.set(horseId, team);
  version++;
  listeners.get(horseId)?.forEach((l) => l());
  anyListeners.forEach((l) => l());
}

async function load(horseId: string): Promise<void> {
  if (!memory.has(horseId)) {
    const cached = await readJson<Record<string, TeamMember[]>>(KEY, {});
    if (!memory.has(horseId)) publish(horseId, cached[horseId] ?? []);
  }
  if (fetched.has(horseId)) return;
  fetched.add(horseId);
  const { data, error } = await supabase.rpc("horse_team", { _horse_id: horseId });
  if (error || !Array.isArray(data)) {
    // Hors ligne ou base pas encore migrée : on garde la copie locale et on
    // réessaiera au prochain lancement.
    fetched.delete(horseId);
    return;
  }
  const team = (data as { userId: string; name: string; role: string }[]).map((m) => ({
    userId: m.userId,
    name: m.name,
    role: m.role as HorseRole,
  }));
  publish(horseId, team);
  const cached = await readJson<Record<string, TeamMember[]>>(KEY, {});
  await writeJson(KEY, { ...cached, [horseId]: team });
}

export async function clearHorseTeams(): Promise<void> {
  memory.clear();
  fetched.clear();
  await removeJson(KEY);
}

/** Relit l'équipe au prochain affichage (après une invitation acceptée, une
 * révocation, un changement de rôle). */
export function invalidateHorseTeam(horseId: string): void {
  fetched.delete(horseId);
}

export function useHorseTeam(horseId: string | null | undefined): TeamMember[] {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!horseId) return () => {};
      let set = listeners.get(horseId);
      if (!set) listeners.set(horseId, (set = new Set()));
      set.add(onChange);
      load(horseId).catch(() => {});
      return () => {
        set.delete(onChange);
      };
    },
    [horseId]
  );
  return useSyncExternalStore(subscribe, () => (horseId ? (memory.get(horseId) ?? EMPTY) : EMPTY));
}

/** Équipes de plusieurs chevaux (planning de la semaine), par cheval. */
export function useHorseTeams(horseIds: string[]): Record<string, TeamMember[]> {
  const key = horseIds.join(",");
  const subscribe = useCallback(
    (onChange: () => void) => {
      anyListeners.add(onChange);
      for (const id of key ? key.split(",") : []) load(id).catch(() => {});
      return () => {
        anyListeners.delete(onChange);
      };
    },
    [key]
  );
  const v = useSyncExternalStore(subscribe, () => version);
  return useMemo(() => {
    void v;
    return Object.fromEntries((key ? key.split(",") : []).map((id) => [id, memory.get(id) ?? EMPTY]));
  }, [key, v]);
}
