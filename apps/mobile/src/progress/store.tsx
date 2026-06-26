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
import { safeJsonParse } from "@/lib/safeJsonParse";
import { pushHorseProgress, type RemoteProgress } from "@/lib/cloudSync";
import { BADGES, unlockedBadgeIds, type Badge } from "@/program/badges";
import { useProgram, type PlannedSession, type ProgramWeekView } from "@/program/store";
import type { FeedbackTrend } from "@/program/types";
import { useHorses } from "@/horses/store";

/**
 * Progression d'entraînement — persistée localement, suivie indépendamment
 * pour CHAQUE cheval (cf. sélecteur sur Today). Today/Planning/Profil lisent
 * toujours la tranche correspondant au cheval actuellement sélectionné dans
 * horses/store.tsx. S'appuie sur le programme réel généré (program/store.tsx)
 * plutôt que sur une trame statique.
 *
 * Quand le programme est régénéré (changement important détecté par
 * program/store.tsx, ou bouton "Nouveau programme"), les ids de séance ne
 * représentent plus forcément la même chose qu'avant : on détecte ce
 * changement via `programGeneratedAt` et on repart à zéro pour CE cheval,
 * plutôt que de garder des "séances faites" qui ne correspondent à rien.
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
  /** generatedAt du programme contre lequel cette progression a été
   * calculée — sert à détecter une régénération depuis la dernière visite. */
  programGeneratedAt: string | null;
};

type PersistedAll = Record<string, PersistedForHorse>;

function emptyPersisted(programGeneratedAt: string | null): PersistedForHorse {
  return { completed: {}, bestWeekStreak: 0, debriefs: {}, programGeneratedAt };
}

/** Nombre de débriefs récents (chronologiques) pris en compte pour la
 * tendance — assez pour ne pas réagir à un coup de fatigue isolé, assez peu
 * pour rester réactif d'une semaine à l'autre. */
const FEEDBACK_WINDOW = 3;

/** Dérive une tendance (-1 = allège, 0 = inchangé, 1 = intensifie) des
 * derniers débriefs réellement saisis, dans l'ordre chronologique des séances
 * (cf. program/store.tsx, qui applique cette tendance aux semaines à venir).
 * Volontairement prudent : il faut une fenêtre pleine de débriefs, et
 * l'unanimité pour intensifier (un seul "difficile" suffit à ne pas le faire). */
function computeFeedbackTrend(sessions: PlannedSession[], debriefs: Record<string, Debrief>): FeedbackTrend {
  const recentMoods = sessions.filter((s) => debriefs[s.id]).slice(-FEEDBACK_WINDOW).map((s) => debriefs[s.id].mood);
  if (recentMoods.length < FEEDBACK_WINDOW) return 0;
  const hardCount = recentMoods.filter((m) => m === "hard").length;
  if (hardCount >= 2) return -1;
  if (recentMoods.every((m) => m === "great")) return 1;
  return 0;
}

/** Semaines complètes d'affilée, en partant de la semaine actuelle vers le passé. */
function computeWeekStreak(
  completed: Record<string, boolean>,
  weeks: ProgramWeekView[],
  currentWeekNumber: number
): number {
  let streak = 0;
  for (let w = currentWeekNumber; w >= 1; w--) {
    const week = weeks.find((pw) => pw.weekNumber === w);
    if (!week || week.sessions.length === 0) continue;
    const allDone = week.sessions.every((s) => completed[s.id]);
    if (allDone) {
      streak++;
    } else if (w !== currentWeekNumber) {
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
  /** Efface la progression locale, tous chevaux confondus (cf. suppression
   * de compte dans Profil). */
  clearAll: () => Promise<void>;
  /** Restaure la progression depuis le cloud (cf. (auth)/login.tsx, quand cet
   * appareil n'a pas encore les données du compte qui vient de se connecter) —
   * remplace entièrement l'état local, jamais un merge (cf. horses/store.tsx
   * hydrateFromCloud, même logique). */
  hydrateFromCloud: (byHorseId: Record<string, RemoteProgress>) => void;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { selectedHorse } = useHorses();
  const { program, weeks, allSessions, currentWeekNumber, recordFeedbackTrend } = useProgram();
  const horseId = selectedHorse?.id ?? null;
  const generatedAt = program?.generatedAt ?? null;

  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState<PersistedAll>({});
  const [celebrationBadge, setCelebrationBadge] = useState<Badge | null>(null);
  const prevUnlockedRef = useRef<Set<string>>(new Set());
  const prevEpochRef = useRef<string | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then((raw) => {
      setAllData(safeJsonParse<PersistedAll>(raw, {}));
      setLoading(false);
    });
  }, []);

  // Si le programme de ce cheval a été régénéré depuis la dernière visite,
  // les anciens ids de séance ne représentent plus la même chose : on repart
  // à zéro pour ce cheval plutôt que de garder une progression incohérente.
  const current = useMemo<PersistedForHorse>(() => {
    if (!horseId) return emptyPersisted(generatedAt);
    const stored = allData[horseId];
    if (!stored || stored.programGeneratedAt === generatedAt) return stored ?? emptyPersisted(generatedAt);
    return emptyPersisted(generatedAt);
  }, [allData, horseId, generatedAt]);

  const epoch = horseId ? `${horseId}:${generatedAt ?? ""}` : null;

  // Pousse la tendance issue des derniers débriefs vers program/store.tsx, qui
  // ajuste l'intensité des semaines pas encore vécues (cf. computeFeedbackTrend).
  useEffect(() => {
    recordFeedbackTrend(computeFeedbackTrend(allSessions, current.debriefs));
  }, [allSessions, current.debriefs, recordFeedbackTrend]);

  // Recalcule le tracker "badges déjà vus" quand on change de cheval ou que
  // son programme est régénéré, pour ne pas déclencher de célébration sur
  // des badges déjà débloqués avant (ou sur un reset qui vient d'avoir lieu).
  useEffect(() => {
    if (loading || prevEpochRef.current === epoch) return;
    prevEpochRef.current = epoch;
    prevUnlockedRef.current = new Set(
      unlockedBadgeIds({
        completedCount: Object.values(current.completed).filter(Boolean).length,
        totalSessions: allSessions.length,
        weekStreak: computeWeekStreak(current.completed, weeks, currentWeekNumber),
        bestWeekStreak: current.bestWeekStreak,
      })
    );
  }, [epoch, loading, current, allSessions.length, weeks, currentWeekNumber]);

  const persist = useCallback(
    (next: PersistedForHorse) => {
      if (!horseId) return;
      setAllData((all) => {
        const nextAll = { ...all, [horseId]: next };
        SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(nextAll));
        return nextAll;
      });
      // Best-effort, ne bloque jamais l'UI (cf. lib/cloudSync.ts) — pour
      // survivre à un changement d'appareil/réinstallation (cf. login.tsx
      // hydrateFromCloud ci-dessous).
      pushHorseProgress(horseId, next).catch(() => {});
    },
    [horseId]
  );

  const toggleSession = useCallback(
    (sessionId: string) => {
      const next = { ...current.completed, [sessionId]: !current.completed[sessionId] };
      const weekStreak = computeWeekStreak(next, weeks, currentWeekNumber);
      const nextBest = Math.max(weekStreak, current.bestWeekStreak);

      const nowUnlocked = unlockedBadgeIds({
        completedCount: Object.values(next).filter(Boolean).length,
        totalSessions: allSessions.length,
        weekStreak,
        bestWeekStreak: nextBest,
      });
      const newlyId = nowUnlocked.find((id) => !prevUnlockedRef.current.has(id));
      prevUnlockedRef.current = new Set(nowUnlocked);
      if (newlyId) setCelebrationBadge(BADGES.find((b) => b.id === newlyId) ?? null);

      persist({ completed: next, bestWeekStreak: nextBest, debriefs: current.debriefs, programGeneratedAt: generatedAt });
    },
    [current, persist, weeks, currentWeekNumber, allSessions.length, generatedAt]
  );

  const isDone = useCallback((sessionId: string) => !!current.completed[sessionId], [current]);
  const dismissCelebration = useCallback(() => setCelebrationBadge(null), []);

  const clearAll = useCallback(async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    setAllData({});
    prevUnlockedRef.current = new Set();
  }, []);

  const hydrateFromCloud = useCallback((byHorseId: Record<string, RemoteProgress>) => {
    const next: PersistedAll = {};
    for (const [hId, p] of Object.entries(byHorseId)) {
      next[hId] = {
        completed: p.completed,
        bestWeekStreak: p.bestWeekStreak,
        debriefs: p.debriefs as Record<string, Debrief>,
        programGeneratedAt: p.programGeneratedAt,
      };
    }
    setAllData(next);
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
    // Le tracker de badges déjà vus sera recalculé par l'effet ci-dessus dès
    // que `current`/`epoch` changent à la prochaine sélection de cheval — pas
    // besoin de le toucher ici directement.
  }, []);

  const getDebrief = useCallback((sessionId: string) => current.debriefs[sessionId] ?? null, [current]);

  const saveDebrief = useCallback(
    (sessionId: string, debrief: Debrief) => {
      persist({ ...current, debriefs: { ...current.debriefs, [sessionId]: debrief }, programGeneratedAt: generatedAt });
    },
    [current, persist, generatedAt]
  );

  const value = useMemo<ProgressContextValue>(() => {
    const completedCount = Object.values(current.completed).filter(Boolean).length;
    const totalSessions = allSessions.length;
    const weekStreak = computeWeekStreak(current.completed, weeks, currentWeekNumber);
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
      clearAll,
      hydrateFromCloud,
    };
  }, [current, loading, isDone, toggleSession, celebrationBadge, dismissCelebration, getDebrief, saveDebrief, clearAll, hydrateFromCloud, allSessions.length, weeks, currentWeekNumber]);

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress doit être utilisé dans <ProgressProvider>");
  return ctx;
}
