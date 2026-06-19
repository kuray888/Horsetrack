import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { ALL_SESSIONS, CURRENT_WEEK_NUMBER, PROGRAM_WEEKS } from "@/program/data";
import { BADGES, unlockedBadgeIds, type Badge } from "@/program/badges";
import { SEED_HORSE_ID, useHorses } from "@/horses/store";

/**
 * Progression d'entraînement — persistée localement, suivie indépendamment
 * pour CHAQUE cheval (cf. sélecteur sur Today). Today/Planning/Profil lisent
 * toujours la tranche correspondant au cheval actuellement sélectionné dans
 * horses/store.tsx.
 */

const STORAGE_KEY = "training_progress_v2";
const XP_PER_SESSION = 20;
const XP_PER_LEVEL = 250;

export type Mood = "great" | "good" | "okay" | "hard";
export type Debrief = { mood: Mood; note: string };

type PersistedForHorse = {
  completed: Record<string, boolean>;
  bestWeekStreak: number;
  debriefs: Record<string, Debrief>;
};

type PersistedAll = Record<string, PersistedForHorse>;

/** Marque les séances passées comme déjà faites, uniquement pour le cheval de
 * démo (h1) — un cheval ajouté plus tard démarre sa progression à zéro. */
function defaultCompletedForSeedHorse(): Record<string, boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Object.fromEntries(ALL_SESSIONS.filter((s) => s.date < today).map((s) => [s.id, true]));
}

function emptyPersistedFor(horseId: string): PersistedForHorse {
  return {
    completed: horseId === SEED_HORSE_ID ? defaultCompletedForSeedHorse() : {},
    bestWeekStreak: 0,
    debriefs: {},
  };
}

/** Semaines complètes d'affilée, en partant de la semaine actuelle vers le passé. */
function computeWeekStreak(completed: Record<string, boolean>): number {
  let streak = 0;
  for (let w = CURRENT_WEEK_NUMBER; w >= 1; w--) {
    const week = PROGRAM_WEEKS.find((pw) => pw.weekNumber === w);
    if (!week || week.sessions.length === 0) continue;
    const allDone = week.sessions.every((s) => completed[s.id]);
    if (allDone) {
      streak++;
    } else if (w !== CURRENT_WEEK_NUMBER) {
      break;
    }
  }
  return streak;
}

type ProgressContextValue = {
  loading: boolean;
  isDone: (sessionId: string) => boolean;
  toggleSession: (sessionId: string) => void;
  completedCount: number;
  totalSessions: number;
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpGoal: number;
  weekStreak: number;
  bestWeekStreak: number;
  unlockedBadges: Badge[];
  celebrationBadge: Badge | null;
  dismissCelebration: () => void;
  getDebrief: (sessionId: string) => Debrief | null;
  saveDebrief: (sessionId: string, debrief: Debrief) => void;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { selectedHorse } = useHorses();
  const horseId = selectedHorse?.id ?? SEED_HORSE_ID;

  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState<PersistedAll>({});
  const [celebrationBadge, setCelebrationBadge] = useState<Badge | null>(null);
  const prevUnlockedRef = useRef<Set<string>>(new Set());
  const prevHorseIdRef = useRef<string | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then((raw) => {
      setAllData(raw ? JSON.parse(raw) : {});
      setLoading(false);
    });
  }, []);

  const current = useMemo<PersistedForHorse>(
    () => allData[horseId] ?? emptyPersistedFor(horseId),
    [allData, horseId]
  );

  // Recalcule le tracker "badges déjà vus" quand on change de cheval, pour ne
  // pas déclencher de célébration sur des badges déjà débloqués avant.
  useEffect(() => {
    if (loading || prevHorseIdRef.current === horseId) return;
    prevHorseIdRef.current = horseId;
    prevUnlockedRef.current = new Set(
      unlockedBadgeIds({
        completedCount: Object.values(current.completed).filter(Boolean).length,
        totalSessions: ALL_SESSIONS.length,
        weekStreak: computeWeekStreak(current.completed),
        bestWeekStreak: current.bestWeekStreak,
      })
    );
  }, [horseId, loading, current]);

  const persist = useCallback(
    (next: PersistedForHorse) => {
      setAllData((all) => {
        const nextAll = { ...all, [horseId]: next };
        SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(nextAll));
        return nextAll;
      });
    },
    [horseId]
  );

  const toggleSession = useCallback(
    (sessionId: string) => {
      const next = { ...current.completed, [sessionId]: !current.completed[sessionId] };
      const weekStreak = computeWeekStreak(next);
      const nextBest = Math.max(weekStreak, current.bestWeekStreak);

      const nowUnlocked = unlockedBadgeIds({
        completedCount: Object.values(next).filter(Boolean).length,
        totalSessions: ALL_SESSIONS.length,
        weekStreak,
        bestWeekStreak: nextBest,
      });
      const newlyId = nowUnlocked.find((id) => !prevUnlockedRef.current.has(id));
      prevUnlockedRef.current = new Set(nowUnlocked);
      if (newlyId) setCelebrationBadge(BADGES.find((b) => b.id === newlyId) ?? null);

      persist({ completed: next, bestWeekStreak: nextBest, debriefs: current.debriefs });
    },
    [current, persist]
  );

  const isDone = useCallback((sessionId: string) => !!current.completed[sessionId], [current]);
  const dismissCelebration = useCallback(() => setCelebrationBadge(null), []);

  const getDebrief = useCallback((sessionId: string) => current.debriefs[sessionId] ?? null, [current]);

  const saveDebrief = useCallback(
    (sessionId: string, debrief: Debrief) => {
      persist({ ...current, debriefs: { ...current.debriefs, [sessionId]: debrief } });
    },
    [current, persist]
  );

  const value = useMemo<ProgressContextValue>(() => {
    const completedCount = Object.values(current.completed).filter(Boolean).length;
    const totalSessions = ALL_SESSIONS.length;
    const weekStreak = computeWeekStreak(current.completed);
    const xp = completedCount * XP_PER_SESSION;

    return {
      loading,
      isDone,
      toggleSession,
      completedCount,
      totalSessions,
      xp,
      level: Math.floor(xp / XP_PER_LEVEL) + 1,
      xpIntoLevel: xp % XP_PER_LEVEL,
      xpGoal: XP_PER_LEVEL,
      weekStreak,
      bestWeekStreak: current.bestWeekStreak,
      unlockedBadges: BADGES.filter((b) =>
        b.isUnlocked({ completedCount, totalSessions, weekStreak, bestWeekStreak: current.bestWeekStreak })
      ),
      celebrationBadge,
      dismissCelebration,
      getDebrief,
      saveDebrief,
    };
  }, [current, loading, isDone, toggleSession, celebrationBadge, dismissCelebration, getDebrief, saveDebrief]);

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress doit être utilisé dans <ProgressProvider>");
  return ctx;
}
