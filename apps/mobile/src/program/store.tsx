import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { safeJsonParse } from "@/lib/safeJsonParse";
import { formatDate } from "@/lib/dateFormat";
import { supabase } from "@/lib/supabase";
import { askProgramInsight } from "@/lib/programInsight";
import { pushHorseProgram, type RemoteProgramData } from "@/lib/cloudSync";
import { DISCIPLINES, RIDER_GOALS } from "@/onboarding/options";
import {
  generateProgram,
  lightSessionOverride,
  PRE_COMPETITION_RISK_TYPES,
  recuperationSession,
  rescaleDuration,
  shiftIntensity,
} from "./rules";
import type { ExerciseStep, FeedbackTrend, GeneratedProgram, SessionIntensity, SessionType } from "./types";
import { useHorses, type Horse } from "@/horses/store";
import { useRiderProfile, type RiderProfile } from "@/rider/store";
import { useAgenda } from "@/agenda/store";
import { useWeather } from "@/weather/store";

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

// v7 : ordre chronologique des séances de la semaine désormais propre à
// chaque discipline plutôt qu'un classement de charge universel (cf.
// DISCIPLINE_SESSION_ORDER dans program/rules.ts) — un programme déjà en
// cache a été généré avec l'ancien ordre, donc bumpée pour que chacun reçoive
// le nouveau déroulé dès la prochaine régénération.
const PROGRAMS_KEY = "programs_v7";
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
  /** Type effectif de la séance — celui généré par le moteur de règles, sauf
   * substitution par un ajustement dynamique (cf. `adaptedReason`), auquel cas
   * il reflète le type réellement affiché (ex: RECUPERATION en repos auto). */
  type: SessionType;
  /** Ajustement automatique appliqué à cette séance précise, ou null si
   * inchangée (cf. "IA adaptative" : repos auto après un rendez-vous
   * vétérinaire ou un concours, allègement en cas de forte chaleur prévue ou
   * de concours le lendemain). */
  adaptedReason: "VET_REST" | "HEAT_TAPER" | "COMPETITION_TAPER" | "COMPETITION_RECOVERY" | null;
};

/** Seuil de température max (°C) au-delà duquel une séance prévue ce jour-là
 * est allégée d'un cran d'intensité — pas la définition officielle Météo-
 * France d'une canicule (qui se déclare sur plusieurs jours consécutifs),
 * mais un seuil de prudence ponctuel suffisant pour l'effort d'un cheval. */
const HEAT_TAPER_THRESHOLD_C = 28;

/** Clé jour (indépendante de l'heure) pour faire correspondre une date de
 * séance à un jour de rendez-vous/prévision météo. */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

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
  /** Restaure programmes/signatures/bilans depuis le cloud (cf. (auth)/login.tsx). */
  hydrateFromCloud: (byHorseId: Record<string, RemoteProgramData>) => void;
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
  /** Explique le prochain ajustement automatique en cours (repos auto après
   * un rendez-vous vétérinaire, allègement par forte chaleur), ou null si
   * aucun n'est actif sur les jours à venir — cf. PlannedSession.adaptedReason. */
  adaptiveNote: string | null;
};

const ProgramContext = createContext<ProgramContextValue | null>(null);

export function ProgramProvider({ children }: { children: ReactNode }) {
  const { selectedHorse } = useHorses();
  const { riderProfile } = useRiderProfile();
  const { appointments } = useAgenda();
  const { forecast } = useWeather();
  const horseId = selectedHorse?.id ?? null;

  // Jours déclenchant un repos automatique : le lendemain d'un rendez-vous
  // "vétérinaire" pour CE cheval (pas de distinction vaccin/visite de routine
  // dans le modèle actuel — cf. Appointment.type, un seul type "veto" — donc
  // toute visite vétérinaire déclenche la prudence, pas seulement un vaccin).
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

  // Jour précédant un concours : séance allégée pour arriver frais à
  // l'épreuve plutôt que d'enchaîner un travail technique complet la veille.
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

  // Lendemain d'un concours : repos automatique pour récupérer de l'effort
  // (physique et mental) de l'épreuve — même logique que vetRestDays.
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

  // Jours avec une chaleur prévue au-delà du seuil de prudence — uniquement
  // sur la fenêtre couverte par la prévision (cf. weather/store.tsx, ~5 jours),
  // les semaines plus lointaines du programme restent inchangées par manque
  // de donnée, pas par choix.
  const heatTaperDays = useMemo(() => {
    const days = new Map<string, number>();
    for (const day of forecast ?? []) {
      if (day.tempMaxC >= HEAT_TAPER_THRESHOLD_C) days.set(dayKey(day.date), day.tempMaxC);
    }
    return days;
  }, [forecast]);

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
    ])
      .then(([rawPrograms, rawSignatures, rawBilanDismissed, rawAiNotes]) => {
        setAllPrograms(safeJsonParse<PersistedPrograms>(rawPrograms, {}));
        setSignatures(safeJsonParse<PersistedSignatures>(rawSignatures, {}));
        setBilanDismissedMap(safeJsonParse<Record<string, string>>(rawBilanDismissed, {}));
        setAiNotes(safeJsonParse<PersistedAiNotes>(rawAiNotes, {}));
      })
      .catch((e) => console.warn("[program] lecture SecureStore échouée, programmes par défaut", e))
      .finally(() => setLoading(false));
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
    // Best-effort, ne bloque jamais l'UI (cf. lib/cloudSync.ts) — pour
    // survivre à un changement d'appareil/réinstallation. Un nouveau
    // programme efface tout bilan ignoré précédent (nouveau generatedAt).
    pushHorseProgram(selectedHorse.id, { program: next, signature: sig, bilanDismissedAt: null }).catch(() => {});
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
    if (!program || !horseId || !selectedHorse) return [];
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
          let intensity = applyTrend ? shiftIntensity(s.intensity, feedbackTrend) : s.intensity;
          let durationMin = applyTrend ? rescaleDuration(s.durationMin, s.intensity, intensity) : s.durationMin;
          let title = s.title;
          let focus = s.focus;
          let equipment = s.equipment;
          let setupNotes = s.setupNotes;
          let exercises = s.exercises;
          let type: SessionType = s.type;
          let adaptedReason: PlannedSession["adaptedReason"] = null;

          const date = dates[s.dayOffset];
          const key = date ? dayKey(date) : null;

          // "IA adaptative" — priorité décroissante : repos médical (véto) >
          // récupération post-concours (même mécanisme de repos complet,
          // l'effort d'une épreuve méritant la même prudence) > allègement
          // pré-concours > allègement canicule. Un repos complet couvre déjà
          // le cas de la chaleur/du concours du lendemain, inutile de cumuler
          // — et inutile sur un jour déjà RECUPERATION dans le programme de base.
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
            adaptedReason = "COMPETITION_RECOVERY";
          } else if (key && competitionTaperDays.has(key) && s.type !== "RECUPERATION") {
            // Le saut/renforcement sont écartés la veille d'un concours (risque
            // de fatigue/blessure de dernière minute) au profit d'un plat léger
            // — un simple cran d'intensité en moins ne suffit pas, le cheval
            // continuerait à sauter juste un peu plus bas. Les types déjà sans
            // risque particulier (plat, sortie, travail à pied) restent les
            // mêmes, juste allégés en intensité.
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
            time: s.time,
            title,
            durationMin,
            focus,
            intensity,
            equipment,
            setupNotes,
            exercises,
            type,
            adaptedReason,
          };
        }),
      };
    });
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

  // N'annonce que le PROCHAIN ajustement à venir (pas un cumul) — même logique
  // d'affichage qu'un seul `feedbackNote` à la fois, pour rester lisible.
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
    const signature = signatures[horseId];
    if (signature) {
      pushHorseProgram(horseId, { program, signature, bilanDismissedAt: program.generatedAt }).catch(() => {});
    }
  }, [horseId, program, signatures]);

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

  /** Restaure programmes/signatures/bilans depuis le cloud (cf. (auth)/login.tsx,
   * quand cet appareil n'a pas encore les données du compte qui vient de se
   * connecter) — remplace entièrement l'état local, jamais un merge. L'éclairage
   * IA n'est volontairement pas restauré : simple cache best-effort, re-demandé
   * automatiquement si besoin (cf. effet authEpoch ci-dessus). */
  const hydrateFromCloud = useCallback((byHorseId: Record<string, RemoteProgramData>) => {
    const programs: PersistedPrograms = {};
    const sigs: PersistedSignatures = {};
    const dismissed: Record<string, string> = {};
    for (const [hId, p] of Object.entries(byHorseId)) {
      programs[hId] = p.program;
      sigs[hId] = p.signature;
      if (p.bilanDismissedAt) dismissed[hId] = p.bilanDismissedAt;
    }
    setAllPrograms(programs);
    setSignatures(sigs);
    setBilanDismissedMap(dismissed);
    persistPrograms(programs);
    persistSignatures(sigs);
    SecureStore.setItemAsync(BILAN_DISMISSED_KEY, JSON.stringify(dismissed));
  }, [persistPrograms, persistSignatures]);

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
      hydrateFromCloud,
      recordFeedbackTrend,
      feedbackNote,
      aiNote,
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
      regenerate,
      isProgramComplete,
      bilanDismissed,
      dismissBilan,
      clearAll,
      hydrateFromCloud,
      recordFeedbackTrend,
      feedbackNote,
      aiNote,
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
