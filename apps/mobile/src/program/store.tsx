import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { generateProgram } from "./rules";
import type { ExerciseStep, GeneratedProgram, SessionIntensity } from "./types";
import { useHorses, type Horse } from "@/horses/store";
import { useRiderProfile, type RiderProfile } from "@/rider/store";

/**
 * Programme d'entraînement — généré par cheval (cf. program/rules.ts) à
 * partir du profil cavalier + du cheval sélectionné, persisté localement.
 * Remplace l'ancien mock unique program/data.ts : chaque cheval a désormais
 * son propre programme, pas une trame identique pour tout le monde.
 *
 * Se régénère automatiquement quand un champ qui compte pour la sécurité/la
 * structure du programme change (cf. `importantSignature`) — pas sur un
 * changement cosmétique (nom, photo...). Le bouton "Nouveau programme" (cf.
 * Planning) permet de redemander une génération à tout moment, y compris
 * pour un changement non "important" (forces/faiblesses, tempérament...).
 */

// v2 : le schéma de séance a changé (exercices structurés en phases + matériel) —
// la clé est bumpée pour ignorer les programmes v1 mis en cache et forcer une
// régénération propre avec le nouveau schéma, sans coder de migration de données.
const PROGRAMS_KEY = "programs_v2";
const SIGNATURES_KEY = "program_signatures_v2";

export type PlannedSession = {
  id: string;
  date: Date;
  dayIndex: number;
  time: string;
  title: string;
  durationMin: number;
  focus: string;
  intensity: SessionIntensity;
  equipment: string[];
  exercises: ExerciseStep[];
};

export type ProgramWeekView = {
  weekNumber: number;
  sessions: PlannedSession[];
};

type PersistedPrograms = Record<string, GeneratedProgram>;
type PersistedSignatures = Record<string, string>;

/** Seuls les champs qui changent vraiment la structure ou la sécurité du
 * programme déclenchent une régénération automatique — un changement de nom
 * ou de photo ne doit pas réinitialiser la progression de la semaine. */
function importantSignature(rider: RiderProfile, horse: Horse): string {
  return JSON.stringify({
    riderLevel: rider.level,
    riderFrequency: rider.rideFrequency,
    riderGoal: rider.primaryGoal,
    horseDiscipline: horse.discipline,
    horseLevel: horse.level,
    horseFitness: horse.fitnessLevel,
    horseWorkload: horse.workload,
    healthConditions: [...horse.healthConditions].sort(),
    injuries: horse.injuries
      .map((i) => `${i.type}:${i.recoveryStatus}:${i.occurredAt ?? ""}`)
      .sort(),
  });
}

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
   * actuel — perd l'historique de complétion lié aux anciens ids de séance
   * (cf. progress/store.tsx, qui détecte ce changement et se réinitialise). */
  regenerate: () => void;
};

const ProgramContext = createContext<ProgramContextValue | null>(null);

export function ProgramProvider({ children }: { children: ReactNode }) {
  const { selectedHorse } = useHorses();
  const { riderProfile } = useRiderProfile();
  const horseId = selectedHorse?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [allPrograms, setAllPrograms] = useState<PersistedPrograms>({});
  const [signatures, setSignatures] = useState<PersistedSignatures>({});

  useEffect(() => {
    Promise.all([SecureStore.getItemAsync(PROGRAMS_KEY), SecureStore.getItemAsync(SIGNATURES_KEY)]).then(
      ([rawPrograms, rawSignatures]) => {
        setAllPrograms(rawPrograms ? JSON.parse(rawPrograms) : {});
        setSignatures(rawSignatures ? JSON.parse(rawSignatures) : {});
        setLoading(false);
      }
    );
  }, []);

  const persistPrograms = useCallback((next: PersistedPrograms) => {
    SecureStore.setItemAsync(PROGRAMS_KEY, JSON.stringify(next));
  }, []);

  const persistSignatures = useCallback((next: PersistedSignatures) => {
    SecureStore.setItemAsync(SIGNATURES_KEY, JSON.stringify(next));
  }, []);

  const regenerate = useCallback(() => {
    if (!selectedHorse) return;
    const next = generateProgram(riderProfile, selectedHorse);
    const sig = importantSignature(riderProfile, selectedHorse);

    setAllPrograms((all) => {
      const updated = { ...all, [selectedHorse.id]: next };
      persistPrograms(updated);
      return updated;
    });
    setSignatures((all) => {
      const updated = { ...all, [selectedHorse.id]: sig };
      persistSignatures(updated);
      return updated;
    });
  }, [selectedHorse, riderProfile, persistPrograms, persistSignatures]);

  // Génère automatiquement le programme d'un cheval qui n'en a pas encore, et
  // régénère dès qu'un champ "important" a changé depuis la dernière génération.
  useEffect(() => {
    if (loading || !horseId || !selectedHorse) return;
    const hasProgram = Boolean(allPrograms[horseId]);
    const sigChanged = signatures[horseId] !== importantSignature(riderProfile, selectedHorse);
    if (!hasProgram || sigChanged) regenerate();
  }, [loading, horseId, selectedHorse, riderProfile, allPrograms, signatures, regenerate]);

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
          intensity: s.intensity,
          equipment: s.equipment,
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
