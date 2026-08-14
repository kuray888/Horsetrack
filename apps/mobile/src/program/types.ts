export type SessionType =
  | "DRESSAGE_BASICS"
  | "ASSOUPLISSEMENT"
  | "BARRES_AU_SOL"
  | "OBSTACLE"
  | "SORTIE_EXTERIEURE"
  | "TRAVAIL_A_PIED"
  | "RENFORCEMENT"
  | "RECUPERATION";

export type SessionIntensity = "LOW" | "MEDIUM" | "HIGH";

/** Ajustement d'intensité dérivé du ressenti réel des dernières séances
 * (cf. progress/store.tsx) : -1 = allège, 0 = inchangé, 1 = intensifie.
 * S'applique uniquement aux semaines pas encore vécues (cf. program/store.tsx). */
export type FeedbackTrend = -1 | 0 | 1;

/** Phase du programme — fait varier l'intensité au fil des semaines plutôt
 * que de répéter la même semaine du début à la fin. */
export type ProgramPhase = "REPRISE" | "DEVELOPPEMENT" | "AFFIRMATION";

/** Phase d'une séance — sert à regrouper les exercices à l'affichage
 * (échauffement / corps de séance / retour au calme), pas à varier l'intensité. */
export type SessionStepPhase = "ECHAUFFEMENT" | "CORPS_DE_SEANCE" | "RETOUR_AU_CALME";

export type ExerciseStep = {
  phase: SessionStepPhase;
  title: string;
  description: string;
  /** Durée indicative de ce bloc précis, en minutes — calculée au prorata de
   * la durée totale de la séance (cf. program/rules.ts buildExercises), pour
   * qu'une séance se lise comme un vrai déroulé chronométré plutôt qu'une
   * liste d'idées sans repère de temps. */
  durationMin: number;
};

export type SessionTemplate = {
  dayOffset: number; // 0 = lundi ... 6 = dimanche
  time: string;
  type: SessionType;
  title: string;
  durationMin: number;
  focus: string;
  intensity: SessionIntensity;
  equipment: string[];
  /** Repères techniques chiffrés (hauteurs, écartements, allures, durées) —
   * distincts du matériel : ce sont des points de départ à ajuster au
   * ressenti, pas des prescriptions strictes (cf. program/rules.ts). */
  setupNotes: string[];
  exercises: ExerciseStep[];
  /** Explication de Julien (l'IA) pour ce choix précis, tenant compte de
   * l'historique réel du cheval — cf. /api/program-week. Absent sur une
   * séance issue du repli déterministe local (véto, chaleur, concours). */
  rationale?: string;
};

/** Durées réelles (en secondes) de chaque exercice une fois calées sur la
 * durée totale actuelle de la séance — nécessaire car `exercises[i].durationMin`
 * peut se désynchroniser de `session.durationMin` : l'exercice bonus (5e étape,
 * cf. program/rules.ts BONUS_EXERCISE_SHARE) ajoute +15% non compensé, et les
 * allègements IA (véto, canicule, ressenti, cf. program/store.tsx) rescalent
 * `durationMin` sans toucher aux exercices. Utilisé à la fois pour l'affichage
 * (session-detail-modal) et le chronomètre (session-active-modal) afin que le
 * temps annoncé corresponde toujours exactement au compte à rebours. */
export function computeExerciseSeconds(exercises: ExerciseStep[], sessionDurationMin: number): number[] {
  const rawTotal = exercises.reduce((s, e) => s + e.durationMin, 0);
  return exercises.map((e) =>
    rawTotal > 0 ? Math.max(60, Math.round((e.durationMin / rawTotal) * sessionDurationMin * 60)) : 300
  );
}

export type ProgramWeek = {
  weekNumber: number;
  /** Absent sur une semaine générée par le cursus continu IA (cf.
   * /api/program-week) — ce découpage figé n'a plus de sens quand la
   * progression est dérivée de l'historique réel plutôt que d'un cycle de
   * 8 semaines. Jamais lu par l'UI (aucun écran n'affiche `week.phase`). */
  phase?: ProgramPhase;
  sessions: SessionTemplate[];
};

export type GeneratedProgram = {
  title: string;
  theme: string;
  /** Nombre de semaines déjà générées pour ce cheval — grandit au fil du
   * temps (cursus continu), ce n'est plus un plafond fixe à 8. */
  totalWeeks: number;
  sessionsPerWeek: number;
  weeks: ProgramWeek[];
  /** Touches personnalisées positives (tempérament, âge...) — à distinguer
   * des restrictions de sécurité. */
  personalizationNotes: string[];
  /** Restrictions appliquées et pourquoi (blessure, santé, repos...) — à
   * afficher au cavalier pour qu'il comprenne les choix du programme. */
  safetyNotes: string[];
  /** Date de la toute première semaine générée pour ce cheval — fixée une
   * fois pour toutes (jamais réinitialisée par une régénération : cette
   * notion n'existe plus, cf. program/store.tsx). Sert de point zéro pour
   * calculer la semaine courante (cf. getWeekDates). */
  generatedAt: string;
  /** Combien de fois chaque type de séance a déjà été programmé pour ce
   * cheval, toute son histoire confondue — transmis à /api/program-week pour
   * que la rotation des variantes d'exercices ne reparte jamais de zéro. */
  typeOccurrences: Record<string, number>;
};
