/**
 * Types du domaine "entraînement", partagés entre apps/mobile (affichage,
 * moteur de secours) et apps/api (route /api/program-week : l'IA choisit le
 * type/l'intensité de chaque séance, ce module fournit le contenu réel et
 * surtout le filtre de sécurité — cf. safety.ts).
 */

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

export type SessionStepPhase = "ECHAUFFEMENT" | "CORPS_DE_SEANCE" | "RETOUR_AU_CALME";

export type ExerciseStep = {
  phase: SessionStepPhase;
  title: string;
  description: string;
  durationMin: number;
};

export type HorseLevel = "UNTRAINED" | "CLUB" | "AMATEUR" | "PRO";

export type Discipline =
  | "SHOW_JUMPING"
  | "DRESSAGE"
  | "EVENTING"
  | "WESTERN"
  | "ENDURANCE"
  | "LEISURE"
  | "ETHOLOGY";

/** Sous-ensemble JSON-safe d'une blessure — `occurredAt` en ISO string (pas
 * `Date`) pour rester transportable tel quel sur la frontière HTTP entre le
 * mobile et /api/program-week. */
export type InjuryInput = {
  type: string;
  recoveryStatus: "RECOVERED" | "IN_PROGRESS" | "ONGOING" | null;
  occurredAt: string | null;
};

/** Sous-ensemble minimal d'un cheval nécessaire au filtre de sécurité et au
 * contenu de séance — pas le type `Horse` complet de mobile/src/horses/store.tsx
 * (qui a des champs non pertinents ici, ex. photoUrl) : ce module ne doit
 * dépendre que de ce qui compte vraiment pour la sécurité/le contenu.
 */
export type SafetyHorseInput = {
  name: string;
  heightCm: number | null;
  level: HorseLevel;
  healthConditions: string[];
  injuries: InjuryInput[];
};
