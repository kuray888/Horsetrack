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
};

export type ProgramWeek = {
  weekNumber: number;
  phase: ProgramPhase;
  sessions: SessionTemplate[];
};

export type GeneratedProgram = {
  title: string;
  theme: string;
  totalWeeks: number;
  sessionsPerWeek: number;
  weeks: ProgramWeek[];
  /** Touches personnalisées positives (tempérament, âge...) — à distinguer
   * des restrictions de sécurité. */
  personalizationNotes: string[];
  /** Restrictions appliquées et pourquoi (blessure, santé, repos...) — à
   * afficher au cavalier pour qu'il comprenne les choix du programme. */
  safetyNotes: string[];
  generatedAt: string;
};
