import { createContext, useCallback, useContext, useEffect, useState, useMemo, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { safeJsonParse } from "@/lib/safeJsonParse";
import { pushTrainingSession, deleteTrainingSessionRemote } from "@/lib/cloudSync";
import type { ActivityType } from "@/agenda/store";
import { useHorses } from "@/horses/store";

/**
 * Séances d'entraînement planifiées manuellement par le cavalier — remplace
 * le cursus généré par IA (retiré du produit). Même pattern de persistance
 * locale + sync cloud best-effort que agenda/store.tsx, mais séparé de ce
 * fichier : une séance planifiée a un cycle de vie distinct (édition possible,
 * pas seulement création/suppression comme Appointment/JournalEntry).
 */

export type SessionIntensity = "low" | "medium" | "high";

export type TrainingSession = {
  id: string;
  /** Cheval auquel cette séance est rattachée — mêmes règles que
   * Appointment.horseId (pilote le partage, cf. RLS can_access_horse). */
  horseId: string | null;
  activityType: ActivityType;
  /** Libellé libre quand aucune des 5 disciplines existantes ne convient (cf.
   * sélection "Autre" dans planning.tsx) — `activityType` garde une valeur
   * technique valide de l'union existante (jamais étendue) pour les stats/le
   * filtrage ; l'affichage préfère ce libellé quand il est renseigné (cf.
   * SessionCard.tsx). Colonne `customActivityLabel` dédiée côté Supabase
   * (text, nullable), synchronisée dans lib/cloudSync.ts. */
  customActivityLabel: string | null;
  date: Date;
  time: string;
  durationMinutes: number | null;
  intensity: SessionIntensity | null;
  notes: string;
  /** Coché une fois la séance faite — suivi simple, sans lien avec un
   * quelconque système de badges/XP (retiré avec l'IA). */
  completed: boolean;
};

export type NewTrainingSession = Omit<TrainingSession, "id" | "horseId" | "completed">;

const SESSIONS_KEY = "training_sessions_v1";

function generateId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

type SessionsContextValue = {
  sessions: TrainingSession[];
  addSession: (session: NewTrainingSession) => void;
  updateSession: (session: TrainingSession) => void;
  deleteSession: (sessionId: string) => void;
  toggleCompleted: (sessionId: string) => void;
  /** Prochaine(s) séance(s) à venir pour le cheval sélectionné, triées par
   * date/heure — utilisé par Today pour la carte "prochaine séance". */
  upcomingForSelectedHorse: TrainingSession[];
  hydrateFromCloud: (sessions: TrainingSession[]) => void;
  /** Efface les séances locales (changement/déconnexion de compte sur cet
   * appareil, cf. (auth)/login.tsx, (onboarding)/account.tsx). */
  clearAll: () => Promise<void>;
  loading: boolean;
};

const SessionsContext = createContext<SessionsContextValue | null>(null);

export function SessionsProvider({ children }: { children: ReactNode }) {
  const { horses, selectedHorse, loading: horsesLoading } = useHorses();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(SESSIONS_KEY);
        const parsed = safeJsonParse<TrainingSession[] | null>(raw, null);
        if (parsed) {
          setSessions(
            parsed.map((s) => ({ ...s, date: new Date(s.date), customActivityLabel: s.customActivityLabel ?? null }))
          );
        }
      } catch (e) {
        console.warn("[sessions] lecture SecureStore échouée", e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Rattache au cheval sélectionné/primaire les séances créées avant que le
  // cheval choisi au moment de la création ait été déterminé — même filet de
  // sécurité que agenda/store.tsx pour Appointment/JournalEntry.
  useEffect(() => {
    if (!loaded || horsesLoading) return;
    const fallbackHorseId = selectedHorse?.id ?? horses.find((h) => h.isPrimary)?.id ?? horses[0]?.id ?? null;
    if (!fallbackHorseId) return;
    setSessions((list) =>
      list.every((s) => s.horseId) ? list : list.map((s) => (s.horseId ? s : { ...s, horseId: fallbackHorseId }))
    );
  }, [loaded, horsesLoading, horses, selectedHorse]);

  useEffect(() => {
    if (!loaded) return;
    SecureStore.setItemAsync(SESSIONS_KEY, JSON.stringify(sessions));
  }, [sessions, loaded]);

  const addSession = useCallback(
    (session: NewTrainingSession) => {
      const next: TrainingSession = { ...session, id: generateId(), horseId: selectedHorse?.id ?? null, completed: false };
      setSessions((list) => [...list, next]);
      pushTrainingSession(next).catch(() => {});
    },
    [selectedHorse]
  );

  const updateSession = useCallback((session: TrainingSession) => {
    setSessions((list) => list.map((s) => (s.id === session.id ? session : s)));
    pushTrainingSession(session).catch(() => {});
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    setSessions((list) => list.filter((s) => s.id !== sessionId));
    deleteTrainingSessionRemote(sessionId).catch(() => {});
  }, []);

  const toggleCompleted = useCallback(
    (sessionId: string) => {
      const target = sessions.find((s) => s.id === sessionId);
      if (!target) return;
      const next = { ...target, completed: !target.completed };
      setSessions((list) => list.map((s) => (s.id === sessionId ? next : s)));
      pushTrainingSession(next).catch(() => {});
    },
    [sessions]
  );

  const hydrateFromCloud = useCallback((remote: TrainingSession[]) => {
    setSessions(remote);
    SecureStore.setItemAsync(SESSIONS_KEY, JSON.stringify(remote));
  }, []);

  const clearAll = useCallback(async () => {
    await SecureStore.deleteItemAsync(SESSIONS_KEY);
    setSessions([]);
  }, []);

  const upcomingForSelectedHorse = useMemo(() => {
    if (!selectedHorse) return [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return sessions
      .filter((s) => s.horseId === selectedHorse.id && !s.completed && s.date >= todayStart)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [sessions, selectedHorse]);

  const value = useMemo<SessionsContextValue>(
    () => ({
      sessions,
      addSession,
      updateSession,
      deleteSession,
      toggleCompleted,
      upcomingForSelectedHorse,
      hydrateFromCloud,
      clearAll,
      loading: !loaded,
    }),
    [sessions, addSession, updateSession, deleteSession, toggleCompleted, upcomingForSelectedHorse, hydrateFromCloud, clearAll, loaded]
  );

  return <SessionsContext.Provider value={value}>{children}</SessionsContext.Provider>;
}

export function useSessions() {
  const ctx = useContext(SessionsContext);
  if (!ctx) throw new Error("useSessions doit être utilisé dans <SessionsProvider>");
  return ctx;
}
