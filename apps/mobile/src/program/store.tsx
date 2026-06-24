import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { safeJsonParse } from "@/lib/safeJsonParse";
import { supabase } from "@/lib/supabase";
import { askProgramInsight } from "@/lib/programInsight";
import { DISCIPLINES, RIDER_GOALS } from "@/onboarding/options";
import { generateProgram, rescaleDuration, shiftIntensity } from "./rules";
import type { ExerciseStep, FeedbackTrend, GeneratedProgram, SessionIntensity } from "./types";
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

// v3 : ajout de `setupNotes` (repères chiffrés) sur SessionTemplate — même
// principe qu'au passage v1 -> v2 : la clé est bumpée pour ignorer les
// programmes déjà en cache (qui n'ont pas ce champ) et forcer une
// régénération propre, sans coder de migration de données.
const PROGRAMS_KEY = "programs_v3";
const SIGNATURES_KEY = "program_signatures_v2";
/** Mémorise, par cheval, la date de génération (`program.generatedAt`) du
 * dernier programme pour lequel l'utilisateur a ignoré le bilan de fin de
 * programme — se réinitialise naturellement à la prochaine régénération
 * (nouveau `generatedAt`), pas besoin de le nettoyer explicitement. */
const BILAN_DISMISSED_KEY = "bilan_dismissed_v1";
/** Cache de l'éclairage IA (cf. /api/program-insight) par cheval — distinct
 * des programmes eux-mêmes : c'est un enrichissement async best-effort, pas
 * une donnée structurelle du moteur de règles. */
const AI_NOTES_KEY = "program_ai_notes_v1";

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
};

export type ProgramWeekView = {
  weekNumber: number;
  sessions: PlannedSession[];
};

type PersistedPrograms = Record<string, GeneratedProgram>;
type PersistedSignatures = Record<string, string>;
/** `note: null` = appel déjà fait, rien d'exploitable à afficher (cf.
 * sentinelle "RIEN" côté /api/program-insight) — distinct de "pas encore demandé".
 * `textSignature` couvre le texte libre (notes du cavalier, notes de blessure) :
 * ces champs ne font pas partie de `importantSignature` (qui ne régénère le
 * programme que sur un changement structurel/sécurité), donc sans ce second
 * signal le cache ne se rafraîchirait jamais après une simple modification de
 * texte tant que `program.generatedAt` reste le même. */
type PersistedAiNotes = Record<string, { generatedAt: string; textSignature: string; note: string | null }>;

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
  /** True une fois le dernier jour de la dernière semaine du programme atteint
   * (indépendant du taux de complétion réel des séances). */
  isProgramComplete: boolean;
  /** True si l'utilisateur a déjà ignoré le bilan de fin de programme pour CE
   * programme précis (réinitialisé à chaque régénération). */
  bilanDismissed: boolean;
  dismissBilan: () => void;
  /** Efface les programmes générés/signatures locaux, tous chevaux confondus
   * (cf. suppression de compte / changement de compte sur cet appareil dans
   * Profil, login.tsx, (onboarding)/account.tsx). */
  clearAll: () => Promise<void>;
  /** Pousse le ressenti récent (cf. progress/store.tsx, qui calcule la
   * tendance à partir des derniers débriefs) pour ajuster l'intensité des
   * semaines pas encore vécues. Volontairement non persisté : recalculé à
   * chaque chargement à partir des débriefs réels, jamais figé. */
  recordFeedbackTrend: (trend: FeedbackTrend) => void;
  /** Explique l'ajustement en cours (ou null si aucun) — affiché dans
   * Planning aux côtés des autres notes de personnalisation/sécurité. */
  feedbackNote: string | null;
  /** Éclairage IA sur le texte libre (cf. /api/program-insight) — null tant
   * qu'il n'y a rien à interpréter, pas encore reçu, ou rien d'exploitable. */
  aiNote: string | null;
};

const ProgramContext = createContext<ProgramContextValue | null>(null);

export function ProgramProvider({ children }: { children: ReactNode }) {
  const { selectedHorse } = useHorses();
  const { riderProfile } = useRiderProfile();
  const horseId = selectedHorse?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [allPrograms, setAllPrograms] = useState<PersistedPrograms>({});
  const [signatures, setSignatures] = useState<PersistedSignatures>({});
  const [bilanDismissedMap, setBilanDismissedMap] = useState<Record<string, string>>({});
  const [feedbackTrend, setFeedbackTrend] = useState<FeedbackTrend>(0);
  const [aiNotes, setAiNotes] = useState<PersistedAiNotes>({});
  const aiFetchingRef = useRef<Set<string>>(new Set());
  const [authEpoch, setAuthEpoch] = useState(0);

  const recordFeedbackTrend = useCallback((trend: FeedbackTrend) => {
    setFeedbackTrend((prev) => (prev === trend ? prev : trend));
  }, []);

  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync(PROGRAMS_KEY),
      SecureStore.getItemAsync(SIGNATURES_KEY),
      SecureStore.getItemAsync(BILAN_DISMISSED_KEY),
      SecureStore.getItemAsync(AI_NOTES_KEY),
    ]).then(([rawPrograms, rawSignatures, rawBilanDismissed, rawAiNotes]) => {
      setAllPrograms(safeJsonParse<PersistedPrograms>(rawPrograms, {}));
      setSignatures(safeJsonParse<PersistedSignatures>(rawSignatures, {}));
      setBilanDismissedMap(safeJsonParse<Record<string, string>>(rawBilanDismissed, {}));
      setAiNotes(safeJsonParse<PersistedAiNotes>(rawAiNotes, {}));
      setLoading(false);
    });
  }, []);

  // Redéclenche une tentative d'éclairage IA une fois la session ouverte —
  // utile car le programme est généré pendant l'onboarding (cf. (onboarding)/
  // paywall.tsx), avant la création de compte ((onboarding)/account.tsx).
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") setAuthEpoch((e) => e + 1);
    });
    return () => sub.subscription.unsubscribe();
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
      // L'ajustement issu du ressenti réel (cf. progress/store.tsx) ne touche
      // que les semaines pas encore vécues : on ne change jamais une semaine
      // déjà en cours ou passée, pour ne pas modifier ce que le cavalier voit
      // déjà au milieu de sa semaine.
      const applyTrend = feedbackTrend !== 0 && week.weekNumber > currentWeekNumber;
      return {
        weekNumber: week.weekNumber,
        sessions: week.sessions.map((s, i) => {
          const intensity = applyTrend ? shiftIntensity(s.intensity, feedbackTrend) : s.intensity;
          const durationMin = applyTrend ? rescaleDuration(s.durationMin, s.intensity, intensity) : s.durationMin;
          return {
            id: `${horseId}-w${week.weekNumber}-s${i}`,
            date: dates[s.dayOffset],
            dayIndex: s.dayOffset,
            time: s.time,
            title: s.title,
            durationMin,
            focus: s.focus,
            intensity,
            equipment: s.equipment,
            setupNotes: s.setupNotes,
            exercises: s.exercises,
          };
        }),
      };
    });
  }, [program, horseId, getWeekDates, feedbackTrend, currentWeekNumber]);

  const feedbackNote = useMemo(() => {
    if (feedbackTrend === -1) {
      return "Programme allégé sur les prochaines séances : plusieurs séances récentes ressenties comme difficiles.";
    }
    if (feedbackTrend === 1) {
      return "Programme intensifié sur les prochaines séances : les dernières ont été ressenties comme top !";
    }
    return null;
  }, [feedbackTrend]);

  // Demande un éclairage IA sur le texte libre (notes du cavalier, notes de
  // blessure) — uniquement s'il y a vraiment du texte à interpréter, une
  // session active (peut ne pas encore exister pendant l'onboarding, cf.
  // authEpoch ci-dessus), et pas déjà fait pour CE programme précis.
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
      if (!data.session) return; // pas encore de compte créé — retentera via authEpoch

      aiFetchingRef.current.add(fetchKey);
      try {
        const note = await askProgramInsight({
          horseName: selectedHorse.name,
          discipline: DISCIPLINES.find((d) => d.value === selectedHorse.discipline)?.label ?? selectedHorse.discipline,
          riderGoal: RIDER_GOALS.find((g) => g.value === riderProfile.primaryGoal)?.label ?? riderProfile.primaryGoal,
          additionalInfo,
          injuries: injuriesWithNotes.map((i) => ({ type: i.type, recoveryStatus: i.recoveryStatus, note: i.note })),
          safetyNotes: program.safetyNotes,
        });
        setAiNotes((prev) => {
          const next = { ...prev, [horseId]: { generatedAt: program.generatedAt, textSignature, note } };
          SecureStore.setItemAsync(AI_NOTES_KEY, JSON.stringify(next));
          return next;
        });
      } catch {
        // Best-effort : pas d'erreur affichée, on retentera à la prochaine
        // régénération ou ouverture de session plutôt que de bloquer l'écran.
      } finally {
        aiFetchingRef.current.delete(fetchKey);
      }
    })();
  }, [loading, horseId, program, selectedHorse, riderProfile, aiNotes, authEpoch]);

  // `program` doit exister explicitement avant de comparer les `generatedAt` :
  // sinon, tant qu'aucune note IA n'a encore été mise en cache ET qu'aucun
  // programme n'a encore été généré (juste après le montage, le temps que
  // l'effet d'auto-génération ci-dessus se déclenche), les deux côtés valent
  // `undefined` et `undefined === undefined` passe à `true` — on tente alors
  // de lire `.note` sur `aiNotes[horseId]`, qui n'existe pas (crash).
  const cachedNote = horseId ? aiNotes[horseId] : undefined;
  const aiNote = program && cachedNote?.generatedAt === program.generatedAt ? cachedNote.note : null;

  const allSessions = useMemo(() => weeks.flatMap((w) => w.sessions), [weeks]);
  const currentWeek = useMemo(
    () => weeks.find((w) => w.weekNumber === currentWeekNumber),
    [weeks, currentWeekNumber]
  );

  const isProgramComplete = useMemo(() => {
    if (!program) return false;
    const lastDay = getWeekDates(program.totalWeeks)[6];
    return lastDay !== undefined && new Date() >= lastDay;
  }, [program, getWeekDates]);

  const bilanDismissed = Boolean(horseId && program && bilanDismissedMap[horseId] === program.generatedAt);

  const dismissBilan = useCallback(() => {
    if (!horseId || !program) return;
    setBilanDismissedMap((prev) => {
      const next = { ...prev, [horseId]: program.generatedAt };
      SecureStore.setItemAsync(BILAN_DISMISSED_KEY, JSON.stringify(next));
      return next;
    });
  }, [horseId, program]);

  const clearAll = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(PROGRAMS_KEY),
      SecureStore.deleteItemAsync(SIGNATURES_KEY),
      SecureStore.deleteItemAsync(BILAN_DISMISSED_KEY),
      SecureStore.deleteItemAsync(AI_NOTES_KEY),
    ]);
    setAllPrograms({});
    setSignatures({});
    setBilanDismissedMap({});
    setAiNotes({});
  }, []);

  const value = useMemo<ProgramContextValue>(
    () => ({
      loading,
      program,
      currentWeekNumber,
      currentWeek,
      weeks,
      allSessions,
      getWeekDates,
      regenerate,
      isProgramComplete,
      bilanDismissed,
      dismissBilan,
      clearAll,
      recordFeedbackTrend,
      feedbackNote,
      aiNote,
    }),
    [
      loading,
      program,
      currentWeekNumber,
      currentWeek,
      weeks,
      allSessions,
      getWeekDates,
      regenerate,
      isProgramComplete,
      bilanDismissed,
      dismissBilan,
      clearAll,
      recordFeedbackTrend,
      feedbackNote,
      aiNote,
    ]
  );

  return <ProgramContext.Provider value={value}>{children}</ProgramContext.Provider>;
}

export function useProgram() {
  const ctx = useContext(ProgramContext);
  if (!ctx) throw new Error("useProgram doit être utilisé dans <ProgramProvider>");
  return ctx;
}
