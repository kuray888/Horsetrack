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

/** Phase du programme — fait varier l'intensité au fil des semaines plutôt
 * que de répéter la même semaine du début à la fin. */
export type ProgramPhase = "REPRISE" | "DEVELOPPEMENT" | "AFFIRMATION";

export type SessionTemplate = {
  dayOffset: number; // 0 = lundi ... 6 = dimanche
  time: string;
  type: SessionType;
  title: string;
  durationMin: number;
  focus: string;
  intensity: SessionIntensity;
  exercises: string[];
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
