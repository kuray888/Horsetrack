import { SESSION_EQUIPMENT, SESSION_META, type SessionIntensity, type SessionStepPhase, type SessionType } from "@/lib/sessionContent";
import type { ActivityType } from "@/agenda/activityKinds";
import type { Discipline, HorseLevel, RiderLevel } from "@/onboarding/store";

/**
 * Bibliothèque d'exercices — la même pour l'écran Bibliothèque et pour le
 * coach (cf. coach/constraints.ts) : un exercice a un identifiant stable
 * (« TYPE.variante.étape »), indépendant de la langue, que le serveur
 * revérifie dans chaque réponse du coach.
 *
 * Le contenu vient de lib/sessionContent.ts (SESSION_META) ; ce module
 * l'aplatit et y ajoute ce qui manquait pour chercher et filtrer :
 * disciplines, niveau minimum, intensité, matériel, type de séance du
 * planning. Logique pure, testée (exerciseLibrary.test.ts).
 */

export type LibraryExercise = {
  id: string;
  type: SessionType;
  phase: SessionStepPhase;
  title: string;
  description: string;
  /** « Dressage — bases » : la séance dont l'exercice est tiré. */
  sessionTitle: string;
  intensity: SessionIntensity;
  equipment: string[];
  /** Vide : toutes les disciplines. */
  disciplines: Discipline[];
  minHorseLevel: HorseLevel;
  minRiderLevel: RiderLevel;
  /** Lien vers une vidéo dont Horsetrack a les droits — aucune pour l'instant. */
  videoUrl: string | null;
};

const ALL: Discipline[] = [];

/** Ce qu'on ajoute au contenu existant, type par type. */
export const SESSION_TYPE_INFO: Record<
  SessionType,
  {
    intensity: SessionIntensity;
    disciplines: Discipline[];
    minHorseLevel: HorseLevel;
    minRiderLevel: RiderLevel;
    /** Type de séance du planning créé par « Planifier » / « Ajouter ». */
    activity: ActivityType;
    /** Séance montée : écartée quand le cheval ne doit pas être monté. */
    ridden: boolean;
    /** Saut ou barres : sol dur ou gelé à éviter. */
    impact: boolean;
    outdoor: boolean;
  }
> = {
  DRESSAGE_BASICS: {
    intensity: "MEDIUM",
    disciplines: ALL,
    minHorseLevel: "UNTRAINED",
    minRiderLevel: "BEGINNER",
    activity: "dressage",
    ridden: true,
    impact: false,
    outdoor: false,
  },
  ASSOUPLISSEMENT: {
    intensity: "LOW",
    disciplines: ALL,
    minHorseLevel: "UNTRAINED",
    minRiderLevel: "BEGINNER",
    activity: "dressage",
    ridden: true,
    impact: false,
    outdoor: false,
  },
  BARRES_AU_SOL: {
    intensity: "MEDIUM",
    disciplines: ["SHOW_JUMPING", "HUNTER", "EVENTING", "DRESSAGE", "LEISURE", "ENDURANCE"],
    minHorseLevel: "UNTRAINED",
    minRiderLevel: "BEGINNER",
    activity: "cso",
    ridden: true,
    impact: true,
    outdoor: false,
  },
  OBSTACLE: {
    intensity: "HIGH",
    disciplines: ["SHOW_JUMPING", "HUNTER", "EVENTING"],
    minHorseLevel: "CLUB",
    minRiderLevel: "GALOP_1_4",
    activity: "cso",
    ridden: true,
    impact: true,
    outdoor: false,
  },
  SORTIE_EXTERIEURE: {
    intensity: "LOW",
    disciplines: ALL,
    minHorseLevel: "UNTRAINED",
    minRiderLevel: "BEGINNER",
    activity: "balade",
    ridden: true,
    impact: false,
    outdoor: true,
  },
  TRAVAIL_A_PIED: {
    intensity: "LOW",
    disciplines: ALL,
    minHorseLevel: "UNTRAINED",
    minRiderLevel: "BEGINNER",
    activity: "travail_a_pied",
    ridden: false,
    impact: false,
    outdoor: false,
  },
  RENFORCEMENT: {
    intensity: "HIGH",
    disciplines: ["SHOW_JUMPING", "EVENTING", "ENDURANCE", "ATTELAGE", "DRESSAGE", "HUNTER"],
    minHorseLevel: "CLUB",
    minRiderLevel: "GALOP_1_4",
    activity: "endurance",
    ridden: true,
    impact: false,
    outdoor: true,
  },
  RECUPERATION: {
    intensity: "LOW",
    disciplines: ALL,
    minHorseLevel: "UNTRAINED",
    minRiderLevel: "BEGINNER",
    activity: "longe",
    ridden: false,
    impact: false,
    outdoor: false,
  },
};

export const SESSION_TYPES = Object.keys(SESSION_META) as SessionType[];

const HORSE_LEVEL_ORDER: HorseLevel[] = ["UNTRAINED", "CLUB", "AMATEUR", "PRO"];
const RIDER_LEVEL_ORDER: RiderLevel[] = ["BEGINNER", "GALOP_1_4", "GALOP_5_7", "AMATEUR", "PRO"];
export const INTENSITY_ORDER: SessionIntensity[] = ["LOW", "MEDIUM", "HIGH"];

export function horseLevelAtLeast(level: HorseLevel | null, min: HorseLevel): boolean {
  return HORSE_LEVEL_ORDER.indexOf(level ?? "UNTRAINED") >= HORSE_LEVEL_ORDER.indexOf(min);
}

export function riderLevelAtLeast(level: RiderLevel | null, min: RiderLevel): boolean {
  // Niveau jamais renseigné : traité comme débutant, par prudence.
  return RIDER_LEVEL_ORDER.indexOf(level ?? "BEGINNER") >= RIDER_LEVEL_ORDER.indexOf(min);
}

export function intensityAtMost(value: SessionIntensity, max: SessionIntensity): boolean {
  return INTENSITY_ORDER.indexOf(value) <= INTENSITY_ORDER.indexOf(max);
}

let cache: LibraryExercise[] | null = null;

/** Tous les exercices, dans l'ordre de la bibliothèque. */
export function libraryExercises(): LibraryExercise[] {
  if (cache) return cache;
  cache = SESSION_TYPES.flatMap((type) => {
    const meta = SESSION_META[type];
    const info = SESSION_TYPE_INFO[type];
    return meta.exerciseVariants.flatMap((variant, v) =>
      variant.map((step, i) => ({
        id: `${type}.${v}.${i}`,
        type,
        phase: step.phase,
        title: step.title,
        description: step.description,
        sessionTitle: meta.title,
        intensity: info.intensity,
        equipment: SESSION_EQUIPMENT[type],
        disciplines: info.disciplines,
        minHorseLevel: info.minHorseLevel,
        minRiderLevel: info.minRiderLevel,
        videoUrl: null,
      }))
    );
  });
  return cache;
}

export function exerciseById(id: string): LibraryExercise | null {
  return libraryExercises().find((e) => e.id === id) ?? null;
}

// --- Recherche ---------------------------------------------------------------

export type LibraryFilter = {
  query?: string;
  discipline?: Discipline | null;
  horseLevel?: HorseLevel | null;
  /** Seulement les exercices sans matériel particulier. */
  noEquipment?: boolean;
  phase?: SessionStepPhase | null;
  favoritesOnly?: boolean;
  favorites?: ReadonlySet<string>;
};

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\*\*/g, "")
    .toLowerCase();

/** Matériel « sans particularité » : la première ligne de SESSION_EQUIPMENT
 * le dit pour ces types de séance. */
const NO_EQUIPMENT_TYPES: SessionType[] = ["DRESSAGE_BASICS", "ASSOUPLISSEMENT", "RENFORCEMENT", "RECUPERATION"];

export function filterLibrary(exercises: LibraryExercise[], filter: LibraryFilter): LibraryExercise[] {
  const words = fold(filter.query ?? "")
    .split(/\s+/)
    .filter(Boolean);
  return exercises.filter((e) => {
    if (filter.favoritesOnly && !filter.favorites?.has(e.id)) return false;
    if (filter.discipline && e.disciplines.length > 0 && !e.disciplines.includes(filter.discipline)) return false;
    if (filter.horseLevel && !horseLevelAtLeast(filter.horseLevel, e.minHorseLevel)) return false;
    if (filter.noEquipment && !NO_EQUIPMENT_TYPES.includes(e.type)) return false;
    if (filter.phase && e.phase !== filter.phase) return false;
    if (words.length === 0) return true;
    const haystack = fold(`${e.title} ${e.description} ${e.sessionTitle} ${e.equipment.join(" ")}`);
    return words.every((w) => haystack.includes(w));
  });
}

/** Ligne de notes ajoutée à une séance par « Ajouter à une séance ». */
export function exerciseNoteLine(e: LibraryExercise): string {
  return `• ${e.title.replace(/\*\*/g, "")}`;
}
