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

/**
 * Progression d'entraînement partagée entre Today, Planning et Profil — persistée
 * localement (en attendant Supabase). C'est la seule source de vérité pour
 * l'état "fait/pas fait" des séances, l'XP, le streak et les badges.
 */

const STORAGE_KEY = "training_progress_v1";
const XP_PER_SESSION = 20;
const XP_PER_LEVEL = 250;

type Persisted = {
  completed: Record<string, boolean>;
  bestWeekStreak: number;
};

function defaultCompleted(): Record<string, boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Object.fromEntries(ALL_SESSIONS.filter((s) => s.date < today).map((s) => [s.id, true]));
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
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [bestWeekStreak, setBestWeekStreak] = useState(0);
  const [celebrationBadge, setCelebrationBadge] = useState<Badge | null>(null);
  const prevUnlockedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then((raw) => {
      const initial: Persisted = raw ? JSON.parse(raw) : { completed: defaultCompleted(), bestWeekStreak: 0 };
      prevUnlockedRef.current = new Set(
        unlockedBadgeIds({
          completedCount: Object.values(initial.completed).filter(Boolean).length,
          totalSessions: ALL_SESSIONS.length,
          weekStreak: computeWeekStreak(initial.completed),
          bestWeekStreak: initial.bestWeekStreak,
        })
      );
      setCompleted(initial.completed);
      setBestWeekStreak(initial.bestWeekStreak);
      setLoading(false);
    });
  }, []);

  const persist = useCallback((next: Persisted) => {
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const toggleSession = useCallback(
    (sessionId: string) => {
      const next = { ...completed, [sessionId]: !completed[sessionId] };
      const weekStreak = computeWeekStreak(next);
      const nextBest = Math.max(weekStreak, bestWeekStreak);

      const nowUnlocked = unlockedBadgeIds({
        completedCount: Object.values(next).filter(Boolean).length,
        totalSessions: ALL_SESSIONS.length,
        weekStreak,
        bestWeekStreak: nextBest,
      });
      const newlyId = nowUnlocked.find((id) => !prevUnlockedRef.current.has(id));
      prevUnlockedRef.current = new Set(nowUnlocked);
      if (newlyId) setCelebrationBadge(BADGES.find((b) => b.id === newlyId) ?? null);

      setCompleted(next);
      if (nextBest !== bestWeekStreak) setBestWeekStreak(nextBest);
      persist({ completed: next, bestWeekStreak: nextBest });
    },
    [completed, bestWeekStreak, persist]
  );

  const isDone = useCallback((sessionId: string) => !!completed[sessionId], [completed]);
  const dismissCelebration = useCallback(() => setCelebrationBadge(null), []);

  const value = useMemo<ProgressContextValue>(() => {
    const completedCount = Object.values(completed).filter(Boolean).length;
    const totalSessions = ALL_SESSIONS.length;
    const weekStreak = computeWeekStreak(completed);
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
      bestWeekStreak,
      unlockedBadges: BADGES.filter((b) => b.isUnlocked({ completedCount, totalSessions, weekStreak, bestWeekStreak })),
      celebrationBadge,
      dismissCelebration,
    };
  }, [completed, loading, isDone, toggleSession, bestWeekStreak, celebrationBadge, dismissCelebration]);

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress doit être utilisé dans <ProgressProvider>");
  return ctx;
}
