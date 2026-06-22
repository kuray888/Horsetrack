import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { generateProgram } from "./rules";
import type { GeneratedProgram } from "./types";
import { useHorses } from "@/horses/store";
import { useRiderProfile } from "@/rider/store";

/**
 * Programme d'entraînement — généré par cheval (cf. program/rules.ts) à
 * partir du profil cavalier + du cheval sélectionné, persisté localement.
 * Remplace l'ancien mock unique program/data.ts : chaque cheval a désormais
 * son propre programme, pas une trame identique pour tout le monde.
 */

const STORAGE_KEY = "programs_v1";

export type PlannedSession = {
  id: string;
  date: Date;
  dayIndex: number;
  time: string;
  title: string;
  durationMin: number;
  focus: string;
  exercises: string[];
};

export type ProgramWeekView = {
  weekNumber: number;
  sessions: PlannedSession[];
};

type PersistedPrograms = Record<string, GeneratedProgram>;

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const idx = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - idx);
  d.setHours(0, 0, 0, 0);
  return d;
}

type ProgramContextValue = {
  loading: boolean;
  program: GeneratedProgram | null;
  /** Semaine du programme qui contient la date du jour (1 si le programme
   * vient d'être généré). */
  currentWeekNumber: number;
  currentWeek: ProgramWeekView | undefined;
  weeks: ProgramWeekView[];
  allSessions: PlannedSession[];
  getWeekDates: (weekNumber: number) => Date[];
  /** Régénère le programme du cheval sélectionné à partir de son profil
   * actuel — perd l'historique de complétion lié aux anciens ids de séance. */
  regenerate: () => void;
};

const ProgramContext = createContext<ProgramContextValue | null>(null);

export function ProgramProvider({ children }: { children: ReactNode }) {
  const { selectedHorse } = useHorses();
  const { riderProfile } = useRiderProfile();
  const horseId = selectedHorse?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [allPrograms, setAllPrograms] = useState<PersistedPrograms>({});

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then((raw) => {
      setAllPrograms(raw ? JSON.parse(raw) : {});
      setLoading(false);
    });
  }, []);

  const persist = useCallback((next: PersistedPrograms) => {
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const regenerate = useCallback(() => {
    if (!selectedHorse) return;
    const next = generateProgram(riderProfile, selectedHorse);
    setAllPrograms((all) => {
      const updated = { ...all, [selectedHorse.id]: next };
      persist(updated);
      return updated;
    });
  }, [selectedHorse, riderProfile, persist]);

  // Génère automatiquement le programme d'un cheval qui n'en a pas encore
  // (premier lancement après l'onboarding, ou nouveau cheval ajouté).
  useEffect(() => {
    if (loading || !horseId) return;
    if (!allPrograms[horseId]) regenerate();
  }, [loading, horseId, allPrograms, regenerate]);

  const program = horseId ? allPrograms[horseId] ?? null : null;

  const getWeekDates = useCallback(
    (weekNumber: number): Date[] => {
      if (!program) return [];
      const start = mondayOf(new Date(program.generatedAt));
      const monday = new Date(start);
      monday.setDate(monday.getDate() + (weekNumber - 1) * 7);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d;
      });
    },
    [program]
  );

  const currentWeekNumber = useMemo(() => {
    if (!program) return 1;
    const start = mondayOf(new Date(program.generatedAt));
    const now = mondayOf(new Date());
    const diffWeeks = Math.round((now.getTime() - start.getTime()) / (7 * 86_400_000));
    return Math.min(program.totalWeeks, Math.max(1, diffWeeks + 1));
  }, [program]);

  const weeks = useMemo<ProgramWeekView[]>(() => {
    if (!program || !horseId) return [];
    return program.weeks.map((week) => {
      const dates = getWeekDates(week.weekNumber);
      return {
        weekNumber: week.weekNumber,
        sessions: week.sessions.map((s, i) => ({
          id: `${horseId}-w${week.weekNumber}-s${i}`,
          date: dates[s.dayOffset],
          dayIndex: s.dayOffset,
          time: s.time,
          title: s.title,
          durationMin: s.durationMin,
          focus: s.focus,
          exercises: s.exercises,
        })),
      };
    });
  }, [program, horseId, getWeekDates]);

  const allSessions = useMemo(() => weeks.flatMap((w) => w.sessions), [weeks]);
  const currentWeek = useMemo(
    () => weeks.find((w) => w.weekNumber === currentWeekNumber),
    [weeks, currentWeekNumber]
  );

  const value = useMemo<ProgramContextValue>(
    () => ({ loading, program, currentWeekNumber, currentWeek, weeks, allSessions, getWeekDates, regenerate }),
    [loading, program, currentWeekNumber, currentWeek, weeks, allSessions, getWeekDates, regenerate]
  );

  return <ProgramContext.Provider value={value}>{children}</ProgramContext.Provider>;
}

export function useProgram() {
  const ctx = useContext(ProgramContext);
  if (!ctx) throw new Error("useProgram doit être utilisé dans <ProgramProvider>");
  return ctx;
}
