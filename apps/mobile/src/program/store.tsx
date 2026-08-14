import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { safeJsonParse } from "@/lib/safeJsonParse";
import { formatDate } from "@/lib/dateFormat";
import { supabase } from "@/lib/supabase";
import { askProgramInsight, type ProgramInsightBonusExercise } from "@/lib/programInsight";
import { pushHorseProgram, type RemoteProgramData } from "@/lib/cloudSync";
import { DISCIPLINES, RIDER_GOALS } from "@/onboarding/options";
import {
  lightSessionOverride,
  PRE_COMPETITION_RISK_TYPES,
  recuperationSession,
  rescaleDuration,
  sessionTime,
  shiftIntensity,
} from "./rules";
import type { ExerciseStep, FeedbackTrend, GeneratedProgram, ProgramWeek, SessionIntensity, SessionType } from "./types";
import { useHorses } from "@/horses/store";
import { useRiderProfile } from "@/rider/store";
import { useAgenda } from "@/agenda/store";
import { useWeather } from "@/weather/store";

/**
 * Cursus d'entraînement — un programme PAR CHEVAL, persisté localement, qui
 * grandit semaine après semaine plutôt que d'être régénéré en bloc tous les
 * 8 jours. La semaine à venir est demandée à /api/program-week (cf.
 * lib/programWeek.ts) dès qu'elle manque : l'IA choisit type/intensité de
 * chaque séance à partir de l'historique réel du cheval (séances faites,
 * ressenti), jamais une trame figée qui se répète à l'identique.
 *
 * Le contenu réel (exercices, matériel, hauteurs de saut...) et le filtre de
 * sécurité (santé/blessures → types exclus, intensité plafonnée) restent
 * exclusivement déterministes, calculés côté serveur avant que la proposition
 * de l'IA n'atteigne jamais l'utilisateur — cf. apps/api/.../program-week et
 * packages/shared/src/training.
 */

// v8 : cursus continu (IA + historique) au lieu d'un cycle fixe de 8 semaines
// régénéré en bloc — un programme en cache v7 n'a plus la même forme
// (totalWeeks n'est plus un plafond, `phase` est optionnelle, nouveau champ
// `typeOccurrences`), donc bumpée pour repartir propre plutôt que de tenter
// de migrer une structure qui n'a plus le même sens.
const PROGRAMS_KEY = "programs_v8";
/** Cache de l'éclairage IA (cf. /api/program-insight) par cheval — distinct
 * des programmes eux-mêmes : c'est un enrichissement async best-effort, pas
 * une donnée structurelle. */
const AI_NOTES_KEY = "program_ai_notes_v2";

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
  setupNotes: string[];
  exercises: ExerciseStep[];
  /** Type effectif de la séance — celui choisi par l'IA (cf. /api/program-week),
   * sauf substitution par un ajustement dynamique (cf. `adaptedReason`), auquel
   * cas il reflète le type réellement affiché (ex: RECUPERATION en repos auto). */
  type: SessionType;
  /** Explication de Julien pour ce choix, tenant compte de l'historique réel
   * du cheval — absente sur une séance issue d'un ajustement dynamique local
   * (véto, chaleur, concours), qui a sa propre explication (cf. adaptedReason). */
  rationale: string | null;
  /** Ajustement automatique appliqué à cette séance précise, ou null si
   * inchangée (cf. "IA adaptative" : repos auto après un rendez-vous
   * vétérinaire ou un concours, allègement en cas de forte chaleur prévue ou
   * de concours le lendemain). */
  adaptedReason: "VET_REST" | "HEAT_TAPER" | "COMPETITION_TAPER" | "COMPETITION_RECOVERY" | null;
};

/** Seuil de température max (°C) au-delà duquel une séance prévue ce jour-là
 * est allégée d'un cran d'intensité. */
const HEAT_TAPER_THRESHOLD_C = 28;

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export type ProgramWeekView = {
  weekNumber: number;
  sessions: PlannedSession[];
};

type PersistedPrograms = Record<string, GeneratedProgram>;
type PersistedAiNotes = Record<
  string,
  {
    generatedAt: string;
    textSignature: string;
    note: string | null;
    bonusExercise: ProgramInsightBonusExercise | null;
  }
>;

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
  /** Semaine du programme qui contient la date du jour (1 si le cursus vient
   * de démarrer pour ce cheval). */
  currentWeekNumber: number;
  currentWeek: ProgramWeekView | undefined;
  weeks: ProgramWeekView[];
  allSessions: PlannedSession[];
  getWeekDates: (weekNumber: number) => Date[];
  /** True pendant la génération de la semaine à venir — piloté par
   * program/CurriculumEngine.tsx (cf. ce fichier), qui seul déclenche l'appel
   * IA : ce provider n'expose que l'état, jamais le fetch lui-même, pour ne
   * pas dépendre de progress/store.tsx (qui dépend déjà de lui). */
  generatingWeek: boolean;
  setGeneratingWeek: (v: boolean) => void;
  /** Ajoute une semaine déjà générée (par CurriculumEngine) au cursus de ce
   * cheval — démarre le programme si c'est la toute première semaine. */
  appendGeneratedWeek: (
    horseId: string,
    week: ProgramWeek,
    typeOccurrences: Record<string, number>,
    safetyNotes: string[],
    horseName: string
  ) => void;
  /** Toujours `false` : un cursus continu n'a pas de fin — conservé
   * uniquement pour la compatibilité de l'écran bilan de fin de programme
   * (cf. app/bilan-modal.tsx, (tabs)/today.tsx), devenu inatteignable avec le
   * cursus continu mais pas retiré de l'app. */
  isProgramComplete: boolean;
  /** Toujours `false`, même raison que isProgramComplete ci-dessus. */
  bilanDismissed: boolean;
  /** No-op, même raison que isProgramComplete ci-dessus. */
  dismissBilan: () => void;
  /** Réinitialise le cursus de ce cheval à zéro (efface toutes les semaines
   * déjà générées) — CurriculumEngine redémarre alors à la semaine 1 au
   * prochain rendu. Remplace l'ancienne "régénération en bloc" (cf. Planning,
   * bouton "Nouveau programme") : on ne peut plus régénérer UNE semaine
   * existante sans casser l'historique sur lequel l'IA s'appuie, seulement
   * repartir de zéro. */
  regenerate: () => void;
  /** Efface les programmes générés localement, tous chevaux confondus (cf.
   * suppression de compte / changement de compte sur cet appareil dans
   * Profil, login.tsx, (onboarding)/account.tsx). */
  clearAll: () => Promise<void>;
  /** Restaure les programmes depuis le cloud (cf. (auth)/login.tsx). */
  hydrateFromCloud: (byHorseId: Record<string, RemoteProgramData>) => void;
  recordFeedbackTrend: (trend: FeedbackTrend) => void;
  /** Tendance brute issue des derniers débriefs (-1 allège, 0 stable, 1 intensifie)
   * — exposée pour la prédiction de surmenage dans today.tsx. */
  feedbackTrend: FeedbackTrend;
  feedbackNote: string | null;
  aiNote: string | null;
  aiBonusExercise: ProgramInsightBonusExercise | null;
  adaptiveNote: string | null;
};

const ProgramContext = createContext<ProgramContextValue | null>(null);

export function ProgramProvider({ children }: { children: ReactNode }) {
  const { selectedHorse } = useHorses();
  const { riderProfile } = useRiderProfile();
  const { appointments } = useAgenda();
  const { forecast } = useWeather();
  const horseId = selectedHorse?.id ?? null;

  const vetRestDays = useMemo(() => {
    const days = new Set<string>();
    if (!horseId) return days;
    for (const appt of appointments) {
      if (appt.horseId !== horseId || appt.type !== "veto") continue;
      const next = new Date(appt.date);
      next.setDate(next.getDate() + 1);
      days.add(dayKey(next));
    }
    return days;
  }, [appointments, horseId]);

  const competitionTaperDays = useMemo(() => {
    const days = new Set<string>();
    if (!horseId) return days;
    for (const appt of appointments) {
      if (appt.horseId !== horseId || appt.type !== "concours") continue;
      const prev = new Date(appt.date);
      prev.setDate(prev.getDate() - 1);
      days.add(dayKey(prev));
    }
    return days;
  }, [appointments, horseId]);

  const competitionRecoveryDays = useMemo(() => {
    const days = new Set<string>();
    if (!horseId) return days;
    for (const appt of appointments) {
      if (appt.horseId !== horseId || appt.type !== "concours") continue;
      const next = new Date(appt.date);
      next.setDate(next.getDate() + 1);
      days.add(dayKey(next));
    }
    return days;
  }, [appointments, horseId]);

  const heatTaperDays = useMemo(() => {
    const days = new Map<string, number>();
    for (const day of forecast ?? []) {
      if (day.tempMaxC >= HEAT_TAPER_THRESHOLD_C) days.set(dayKey(day.date), day.tempMaxC);
    }
    return days;
  }, [forecast]);

  const [loading, setLoading] = useState(true);
  const [allPrograms, setAllPrograms] = useState<PersistedPrograms>({});
  const [feedbackTrend, setFeedbackTrend] = useState<FeedbackTrend>(0);
  const [aiNotes, setAiNotes] = useState<PersistedAiNotes>({});
  const [generatingWeek, setGeneratingWeek] = useState(false);
  const aiFetchingRef = useRef<Set<string>>(new Set());
  const [authEpoch, setAuthEpoch] = useState(0);

  const recordFeedbackTrend = useCallback((trend: FeedbackTrend) => {
    setFeedbackTrend((prev) => (prev === trend ? prev : trend));
  }, []);

  useEffect(() => {
    Promise.all([SecureStore.getItemAsync(PROGRAMS_KEY), SecureStore.getItemAsync(AI_NOTES_KEY)]).then(
      ([rawPrograms, rawAiNotes]) => {
        setAllPrograms(safeJsonParse<PersistedPrograms>(rawPrograms, {}));
        setAiNotes(safeJsonParse<PersistedAiNotes>(rawAiNotes, {}));
        setLoading(false);
      }
    );
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") setAuthEpoch((e) => e + 1);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const persistPrograms = useCallback((next: PersistedPrograms) => {
    SecureStore.setItemAsync(PROGRAMS_KEY, JSON.stringify(next));
  }, []);

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
    return Math.max(1, diffWeeks + 1);
  }, [program]);

  // Ajoute (ou démarre) une semaine déjà générée par program/CurriculumEngine.tsx
  // — seule façon d'écrire dans `allPrograms`, pour que bootstrap et suite du
  // cursus partagent exactement la même logique de persistance locale + cloud.
  // Ce provider ne déclenche jamais lui-même l'appel IA (cf. déclaration du
  // type ci-dessus) : CurriculumEngine a besoin à la fois de ce contexte ET de
  // useProgress() (savoir quelles séances sont faites, avec quel ressenti),
  // que ce provider ne peut pas lire sans dépendance circulaire.
  const appendGeneratedWeek = useCallback(
    (hId: string, week: ProgramWeek, typeOccurrences: Record<string, number>, safetyNotes: string[], horseName: string) => {
      setAllPrograms((all) => {
        const existing = all[hId];
        const next: GeneratedProgram = existing
          ? { ...existing, weeks: [...existing.weeks, week], typeOccurrences, safetyNotes }
          : {
              title: `Programme de ${horseName}`,
              theme: "Un cursus qui s'adapte à chaque semaine, à partir de ce qui a vraiment été fait.",
              totalWeeks: 1,
              sessionsPerWeek: week.sessions.length,
              weeks: [week],
              personalizationNotes: [],
              safetyNotes,
              generatedAt: new Date().toISOString(),
              typeOccurrences,
            };
        next.totalWeeks = next.weeks.length;
        const updated = { ...all, [hId]: next };
        persistPrograms(updated);
        pushHorseProgram(hId, { program: next, signature: "", bilanDismissedAt: null }).catch(() => {});
        return updated;
      });
    },
    [persistPrograms]
  );

  // Repart de zéro pour ce cheval (cf. commentaire sur `regenerate` dans le
  // type ci-dessus) — CurriculumEngine détecte l'absence de programme et
  // relance la génération de la semaine 1 au prochain rendu.
  const regenerate = useCallback(() => {
    if (!horseId) return;
    setAllPrograms((all) => {
      const updated = { ...all };
      delete updated[horseId];
      persistPrograms(updated);
      pushHorseProgram(horseId, {
        program: {
          title: "",
          theme: "",
          totalWeeks: 0,
          sessionsPerWeek: 0,
          weeks: [],
          personalizationNotes: [],
          safetyNotes: [],
          generatedAt: new Date().toISOString(),
          typeOccurrences: {},
        },
        signature: "",
        bilanDismissedAt: null,
      }).catch(() => {});
      return updated;
    });
  }, [horseId, persistPrograms]);

  const cachedAi = horseId ? aiNotes[horseId] : undefined;
  const aiNote = program && cachedAi?.generatedAt === program.generatedAt ? cachedAi.note : null;
  const aiBonusExercise = program && cachedAi?.generatedAt === program.generatedAt ? cachedAi.bonusExercise : null;

  const weeks = useMemo<ProgramWeekView[]>(() => {
    if (!program || !horseId || !selectedHorse) return [];
    const built = program.weeks.map((week) => {
      const dates = getWeekDates(week.weekNumber);
      const applyTrend = feedbackTrend !== 0 && week.weekNumber > currentWeekNumber;
      return {
        weekNumber: week.weekNumber,
        sessions: week.sessions.map((s, i) => {
          let intensity = applyTrend ? shiftIntensity(s.intensity, feedbackTrend) : s.intensity;
          let durationMin = applyTrend ? rescaleDuration(s.durationMin, s.intensity, intensity) : s.durationMin;
          let title = s.title;
          let focus = s.focus;
          let equipment = s.equipment;
          let setupNotes = s.setupNotes;
          let exercises = s.exercises;
          let type: SessionType = s.type;
          let rationale: string | null = s.rationale ?? null;
          let adaptedReason: PlannedSession["adaptedReason"] = null;

          const date = dates[s.dayOffset];
          const key = date ? dayKey(date) : null;

          if (key && vetRestDays.has(key) && s.type !== "RECUPERATION") {
            const recup = recuperationSession(week.weekNumber - 1, selectedHorse);
            title = `🩺 ${recup.title}`;
            focus = `${recup.focus} — après le rendez-vous vétérinaire d'hier`;
            durationMin = recup.durationMin;
            equipment = recup.equipment;
            setupNotes = [];
            exercises = recup.exercises;
            intensity = "LOW";
            type = "RECUPERATION";
            rationale = null;
            adaptedReason = "VET_REST";
          } else if (key && competitionRecoveryDays.has(key) && s.type !== "RECUPERATION") {
            const recup = recuperationSession(week.weekNumber - 1, selectedHorse);
            title = `🏆 ${recup.title}`;
            focus = `${recup.focus} — récupération après le concours d'hier`;
            durationMin = recup.durationMin;
            equipment = recup.equipment;
            setupNotes = [];
            exercises = recup.exercises;
            intensity = "LOW";
            type = "RECUPERATION";
            rationale = null;
            adaptedReason = "COMPETITION_RECOVERY";
          } else if (key && competitionTaperDays.has(key) && s.type !== "RECUPERATION") {
            if (PRE_COMPETITION_RISK_TYPES.has(s.type)) {
              const light = lightSessionOverride("ASSOUPLISSEMENT", week.weekNumber - 1, selectedHorse);
              title = `🏆 ${light.title}`;
              focus = `${light.focus} — plat léger, concours demain`;
              durationMin = light.durationMin;
              equipment = light.equipment;
              setupNotes = [];
              exercises = light.exercises;
              intensity = "LOW";
              type = "ASSOUPLISSEMENT";
              rationale = null;
            } else {
              const tapered = shiftIntensity(intensity, -1);
              durationMin = rescaleDuration(durationMin, intensity, tapered);
              intensity = tapered;
              title = `🏆 ${title}`;
              focus = `${focus} — allégée, concours demain`;
            }
            adaptedReason = "COMPETITION_TAPER";
          } else if (key && heatTaperDays.has(key) && s.type !== "RECUPERATION") {
            const tempMax = heatTaperDays.get(key)!;
            const tapered = shiftIntensity(intensity, -1);
            durationMin = rescaleDuration(durationMin, intensity, tapered);
            intensity = tapered;
            title = `🌡️ ${title}`;
            focus = `${focus} — allégée, forte chaleur prévue (${tempMax}°C)`;
            adaptedReason = "HEAT_TAPER";
          }

          return {
            id: `${horseId}-w${week.weekNumber}-s${i}`,
            date,
            dayIndex: s.dayOffset,
            time: sessionTime(s.dayOffset, riderProfile.preferredTime),
            title,
            durationMin,
            focus,
            intensity,
            equipment,
            setupNotes,
            exercises,
            type,
            rationale,
            adaptedReason,
          };
        }),
      };
    });

    if (aiBonusExercise) {
      const now = Date.now();
      outer: for (const week of built) {
        for (const session of week.sessions) {
          if (session.type === "RECUPERATION" || session.adaptedReason) continue;
          if (!session.date || session.date.getTime() < now) continue;
          session.exercises = [
            ...session.exercises,
            {
              phase: "CORPS_DE_SEANCE",
              title: `🗒️ ${aiBonusExercise.title}`,
              description: aiBonusExercise.description,
              durationMin: Math.max(5, Math.min(10, Math.round(session.durationMin * 0.15))),
            },
          ];
          break outer;
        }
      }
    }

    return built;
  }, [
    program,
    horseId,
    selectedHorse,
    getWeekDates,
    feedbackTrend,
    currentWeekNumber,
    vetRestDays,
    heatTaperDays,
    competitionTaperDays,
    competitionRecoveryDays,
    aiBonusExercise,
    riderProfile.preferredTime,
  ]);

  const feedbackNote = useMemo(() => {
    if (feedbackTrend === -1) {
      return "Programme allégé sur les prochaines séances : plusieurs séances récentes ressenties comme difficiles.";
    }
    if (feedbackTrend === 1) {
      return "Programme intensifié sur les prochaines séances : les dernières ont été ressenties comme top !";
    }
    return null;
  }, [feedbackTrend]);

  useEffect(() => {
    if (loading || !horseId || !program || !selectedHorse) return;

    const additionalInfo = riderProfile.additionalInfo.trim();
    const injuriesWithNotes = selectedHorse.injuries.filter((i) => i.note.trim().length > 0);
    if (!additionalInfo && injuriesWithNotes.length === 0) return;

    const textSignature = JSON.stringify([additionalInfo, injuriesWithNotes.map((i) => i.note.trim())]);
    const cached = aiNotes[horseId];
    if (cached && cached.generatedAt === program.generatedAt && cached.textSignature === textSignature) return;

    const fetchKey = `${horseId}:${program.generatedAt}:${textSignature}`;
    if (aiFetchingRef.current.has(fetchKey)) return;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;

      aiFetchingRef.current.add(fetchKey);
      try {
        const { note, bonusExercise } = await askProgramInsight({
          horseName: selectedHorse.name,
          discipline: DISCIPLINES.find((d) => d.value === selectedHorse.discipline)?.label ?? selectedHorse.discipline,
          riderGoal: RIDER_GOALS.find((g) => g.value === riderProfile.primaryGoal)?.label ?? riderProfile.primaryGoal,
          additionalInfo,
          injuries: injuriesWithNotes.map((i) => ({ type: i.type, recoveryStatus: i.recoveryStatus, note: i.note })),
          safetyNotes: program.safetyNotes,
        });
        setAiNotes((prev) => {
          const next = { ...prev, [horseId]: { generatedAt: program.generatedAt, textSignature, note, bonusExercise } };
          SecureStore.setItemAsync(AI_NOTES_KEY, JSON.stringify(next));
          return next;
        });
      } catch {
        // Best-effort.
      } finally {
        aiFetchingRef.current.delete(fetchKey);
      }
    })();
  }, [loading, horseId, program, selectedHorse, riderProfile, aiNotes, authEpoch]);

  const allSessions = useMemo(() => weeks.flatMap((w) => w.sessions), [weeks]);
  const currentWeek = useMemo(
    () => weeks.find((w) => w.weekNumber === currentWeekNumber),
    [weeks, currentWeekNumber]
  );

  const adaptiveNote = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const next = allSessions
      .filter((s) => s.adaptedReason && s.date >= todayStart)
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
    if (!next) return null;
    const when = next.date.getTime() === todayStart.getTime() ? "aujourd'hui" : `le ${formatDate(next.date)}`;
    switch (next.adaptedReason) {
      case "VET_REST":
        return `Repos automatique ${when} suite au rendez-vous vétérinaire de la veille.`;
      case "COMPETITION_RECOVERY":
        return `Repos automatique ${when} après le concours d'hier.`;
      case "COMPETITION_TAPER":
        return `Séance allégée ${when} : concours demain.`;
      default:
        return `Séance allégée ${when} : forte chaleur prévue.`;
    }
  }, [allSessions]);

  const clearAll = useCallback(async () => {
    await Promise.all([SecureStore.deleteItemAsync(PROGRAMS_KEY), SecureStore.deleteItemAsync(AI_NOTES_KEY)]);
    setAllPrograms({});
    setAiNotes({});
  }, []);

  const hydrateFromCloud = useCallback(
    (byHorseId: Record<string, RemoteProgramData>) => {
      const programs: PersistedPrograms = {};
      for (const [hId, p] of Object.entries(byHorseId)) {
        // `typeOccurrences` : absent d'un programme poussé au cloud avant son
        // introduction — comblé plutôt que de laisser `undefined` (même
        // souci déjà rencontré sur Horse.restDayActivities, cf. horses/store.tsx).
        programs[hId] = { ...p.program, typeOccurrences: p.program.typeOccurrences ?? {} };
      }
      setAllPrograms(programs);
      persistPrograms(programs);
    },
    [persistPrograms]
  );

  const value = useMemo<ProgramContextValue>(
    () => ({
      loading,
      program,
      currentWeekNumber,
      currentWeek,
      weeks,
      allSessions,
      getWeekDates,
      generatingWeek,
      setGeneratingWeek,
      appendGeneratedWeek,
      isProgramComplete: false,
      bilanDismissed: false,
      dismissBilan: () => {},
      regenerate,
      clearAll,
      hydrateFromCloud,
      recordFeedbackTrend,
      feedbackTrend,
      feedbackNote,
      aiNote,
      aiBonusExercise,
      adaptiveNote,
    }),
    [
      loading,
      program,
      currentWeekNumber,
      currentWeek,
      weeks,
      allSessions,
      getWeekDates,
      generatingWeek,
      appendGeneratedWeek,
      regenerate,
      clearAll,
      hydrateFromCloud,
      recordFeedbackTrend,
      feedbackTrend,
      feedbackNote,
      aiNote,
      aiBonusExercise,
      adaptiveNote,
    ]
  );

  return <ProgramContext.Provider value={value}>{children}</ProgramContext.Provider>;
}

export function useProgram() {
  const ctx = useContext(ProgramContext);
  if (!ctx) throw new Error("useProgram doit être utilisé dans <ProgramProvider>");
  return ctx;
}
