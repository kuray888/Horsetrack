import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { safeJsonParse } from "@/lib/safeJsonParse";
import { supabase } from "@/lib/supabase";
import type { RiderGoal } from "@/onboarding/store";

/**
 * Objectifs du cavalier — éventuellement liés à un cheval précis (ex: "Réussir
 * le concours de printemps avec Tornado"), distincts de `RiderProfile.primaryGoal`
 * (l'objectif global unique qui oriente le programme). Persistés localement et
 * synchronisés vers la table `goals` (déjà définie côté Prisma/Supabase, RLS
 * supposée alignée sur le même modèle que horses/rider_profiles) en best-effort,
 * comme l'écurie et le profil cavalier (cf. lib/cloudSync.ts) : un échec réseau
 * ne doit jamais bloquer l'ajout/la modification d'un objectif, seulement
 * retarder sa sauvegarde distante.
 */

const STORAGE_KEY = "goals_v1";

export type Goal = {
  id: string;
  title: string;
  type: RiderGoal | null;
  targetDate: Date | null;
  /** Cheval concerné, ou null si l'objectif ne vise pas un cheval en particulier. */
  horseId: string | null;
};

export type NewGoal = Omit<Goal, "id">;

function generateId(): string {
  return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function reviveGoals(goals: Goal[]): Goal[] {
  return goals.map((g) => ({ ...g, targetDate: g.targetDate ? new Date(g.targetDate) : null }));
}

async function getOwnerProfileId(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;
  const { data: profile } = await supabase.from("rider_profiles").select("id").eq("userId", userId).maybeSingle();
  return profile?.id ?? null;
}

/** Best-effort : silencieux en cas d'échec réseau OU si la RLS de la table
 * `goals` n'est pas (encore) alignée — l'objectif reste fonctionnel en local
 * dans les deux cas, seule la synchronisation cloud est concernée. */
async function pushGoal(goal: Goal): Promise<void> {
  const riderId = await getOwnerProfileId();
  if (!riderId) return;
  await supabase.from("goals").upsert({
    id: goal.id,
    riderId,
    horseId: goal.horseId,
    title: goal.title,
    type: goal.type,
    targetDate: goal.targetDate?.toISOString() ?? null,
    updatedAt: new Date().toISOString(),
  });
}

async function deleteGoalRemote(id: string): Promise<void> {
  await supabase.from("goals").delete().eq("id", id);
}

/** Exporté pour (auth)/login.tsx : un changement de compte sur cet appareil
 * vide les objectifs locaux (cf. clearAll) avant de relire le cloud — sans un
 * appel explicite et attendu ici, on ne pourrait compter QUE sur le
 * `syncFromCloud` interne déclenché par SIGNED_IN ci-dessous, qui course
 * potentiellement avec ce vidage (l'aller-retour réseau peut résoudre avant
 * OU après `clearAll`, selon le timing). */
export async function pullAllGoals(): Promise<Goal[]> {
  return (await fetchCloudGoals()) ?? [];
}

async function fetchCloudGoals(): Promise<Goal[] | null> {
  const riderId = await getOwnerProfileId();
  if (!riderId) return null;
  const { data, error } = await supabase.from("goals").select("*").eq("riderId", riderId);
  if (error || !data) return null;
  return data.map((g) => ({
    id: g.id,
    title: g.title,
    type: g.type,
    targetDate: g.targetDate ? new Date(g.targetDate) : null,
    horseId: g.horseId,
  }));
}

type GoalsContextValue = {
  loading: boolean;
  goals: Goal[];
  addGoal: (goal: NewGoal) => void;
  updateGoal: (id: string, goal: NewGoal) => void;
  deleteGoal: (id: string) => void;
  /** Efface les objectifs locaux (cf. changement de compte sur cet appareil
   * dans login.tsx/(onboarding)/account.tsx, suppression de compte dans Profil). */
  clearAll: () => Promise<void>;
  /** Restaure les objectifs depuis le cloud (cf. (auth)/login.tsx) — remplace
   * entièrement l'état local, jamais un merge (même logique que horses/store.tsx). */
  hydrateFromCloud: (goals: Goal[]) => void;
};

const GoalsContext = createContext<GoalsContextValue | null>(null);

export function GoalsProvider({ children }: { children: ReactNode }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const persist = useCallback((next: Goal[]) => {
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
  }, []);

  // Charge le cache local immédiatement (rapide, dispo hors-ligne), puis
  // réconcilie avec le cloud dès qu'une session existe — le cloud est la
  // source de vérité pour un objectif créé sur un autre appareil.
  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then((raw) => {
      setGoals(reviveGoals(safeJsonParse<Goal[]>(raw, [])));
      setLoading(false);
    });

    const syncFromCloud = () => {
      fetchCloudGoals().then((cloud) => {
        if (!cloud) return;
        setGoals(cloud);
        persist(cloud);
      });
    };
    syncFromCloud();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") syncFromCloud();
    });
    return () => sub.subscription.unsubscribe();
  }, [persist]);

  const addGoal = useCallback(
    (goal: NewGoal) => {
      const next: Goal = { ...goal, id: generateId() };
      setGoals((prev) => {
        const updated = [...prev, next];
        persist(updated);
        return updated;
      });
      pushGoal(next).catch(() => {});
    },
    [persist]
  );

  const updateGoal = useCallback(
    (id: string, goal: NewGoal) => {
      const next: Goal = { ...goal, id };
      setGoals((prev) => {
        const updated = prev.map((g) => (g.id === id ? next : g));
        persist(updated);
        return updated;
      });
      pushGoal(next).catch(() => {});
    },
    [persist]
  );

  const deleteGoal = useCallback(
    (id: string) => {
      setGoals((prev) => {
        const updated = prev.filter((g) => g.id !== id);
        persist(updated);
        return updated;
      });
      deleteGoalRemote(id).catch(() => {});
    },
    [persist]
  );

  const clearAll = useCallback(async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    setGoals([]);
  }, []);

  const hydrateFromCloud = useCallback(
    (next: Goal[]) => {
      setGoals(next);
      persist(next);
    },
    [persist]
  );

  const value = useMemo<GoalsContextValue>(
    () => ({ loading, goals, addGoal, updateGoal, deleteGoal, clearAll, hydrateFromCloud }),
    [loading, goals, addGoal, updateGoal, deleteGoal, clearAll, hydrateFromCloud]
  );

  return <GoalsContext.Provider value={value}>{children}</GoalsContext.Provider>;
}

export function useGoals() {
  const ctx = useContext(GoalsContext);
  if (!ctx) throw new Error("useGoals doit être utilisé dans <GoalsProvider>");
  return ctx;
}
