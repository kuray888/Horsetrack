import { DISCIPLINES, NO_HEALTH_CONDITION } from "@/onboarding/options";
import type {
  Discipline,
  HorseFitnessLevel,
  HorseLevel,
  HorseWorkload,
  RideFrequency,
  RiderGoal,
  RiderLevel,
} from "@/onboarding/store";
import type { Horse, Injury } from "@/horses/store";
import type { RiderProfile } from "@/rider/store";
import type { GeneratedProgram, ProgramPhase, SessionIntensity, SessionTemplate, SessionType } from "./types";

/**
 * Moteur de règles V1 — première version volontairement transparente
 * (pas de boîte noire), à ajuster avec un vrai regard équestre/vétérinaire
 * avant de la considérer fiable sur la partie sécurité/santé : les seuils et
 * la liste de gravité par type de blessure ci-dessous sont des hypothèses de
 * départ, pas une vérité médicale.
 *
 * Ne lit pas encore le texte libre (notes du cavalier, notes de blessure) —
 * volontairement laissé pour l'Étape 2 (LLM), qui seul peut interpréter du
 * texte libre sans tomber dans du pattern-matching fragile.
 */

const TOTAL_WEEKS = 8;
const INTENSITY_ORDER: SessionIntensity[] = ["LOW", "MEDIUM", "HIGH"];
/** Une blessure déclarée "rétablie" il y a moins de ~8 semaines reste sous
 * surveillance légère (risque de récidive en phase de reprise). */
const RECENT_RECOVERY_WINDOW_DAYS = 56;

const RIDER_LEVEL_SCORE: Record<RiderLevel, number> = {
  BEGINNER: 1,
  GALOP_1_4: 2,
  GALOP_5_7: 3,
  AMATEUR: 4,
  PRO: 5,
};

const HORSE_LEVEL_SCORE: Record<HorseLevel, number> = {
  UNTRAINED: 1,
  CLUB: 2,
  AMATEUR: 3,
  PRO: 4,
};

const FITNESS_SCORE: Record<HorseFitnessLevel, number> = {
  RESTING: 0,
  REOPENING: 1,
  GOOD: 2,
  PEAK: 3,
};

const RIDER_FREQUENCY_SESSIONS: Record<RideFrequency, number> = {
  DAILY: 6,
  SEVERAL_PER_WEEK: 4,
  WEEKEND: 2,
  OCCASIONAL: 1,
};

const WORKLOAD_CAP: Record<HorseWorkload, number> = {
  NONE: 1,
  ONE_TO_TWO: 2,
  THREE_TO_FOUR: 4,
  FIVE_TO_SIX: 6,
  DAILY: 7,
};

const DISCIPLINE_POOL: Record<Discipline, SessionType[]> = {
  SHOW_JUMPING: ["OBSTACLE", "BARRES_AU_SOL", "DRESSAGE_BASICS", "SORTIE_EXTERIEURE"],
  DRESSAGE: ["DRESSAGE_BASICS", "ASSOUPLISSEMENT", "TRAVAIL_A_PIED", "SORTIE_EXTERIEURE"],
  EVENTING: ["OBSTACLE", "DRESSAGE_BASICS", "SORTIE_EXTERIEURE", "RENFORCEMENT"],
  WESTERN: ["DRESSAGE_BASICS", "ASSOUPLISSEMENT", "TRAVAIL_A_PIED", "SORTIE_EXTERIEURE"],
  ENDURANCE: ["SORTIE_EXTERIEURE", "RENFORCEMENT", "ASSOUPLISSEMENT", "TRAVAIL_A_PIED"],
  LEISURE: ["SORTIE_EXTERIEURE", "TRAVAIL_A_PIED", "ASSOUPLISSEMENT"],
  ETHOLOGY: ["TRAVAIL_A_PIED", "ASSOUPLISSEMENT", "SORTIE_EXTERIEURE"],
};

const GOAL_PREFERRED_TYPE: Partial<Record<RiderGoal, SessionType>> = {
  BONDING: "TRAVAIL_A_PIED",
  CONFIDENCE: "TRAVAIL_A_PIED",
  FITNESS: "RENFORCEMENT",
};

const GOAL_THEME: Record<RiderGoal, string> = {
  COMPETE: "Progresser en concours, étape par étape.",
  BONDING: "Renforcer la complicité avant tout.",
  FITNESS: "Remettre en forme en douceur.",
  EVENT_PREP: "Préparer le prochain événement.",
  CONFIDENCE: "Reprendre confiance, sans pression.",
};

/** 2 variantes par type pour qu'une même séance ne soit pas identique à
 * chaque occurrence dans le programme. */
const SESSION_META: Record<
  SessionType,
  { title: string; focus: string; baseDurationMin: number; exerciseVariants: string[][] }
> = {
  DRESSAGE_BASICS: {
    title: "Dressage — bases",
    focus: "Engagement & rectitude",
    baseDurationMin: 45,
    exerciseVariants: [
      ["Échauffement progressif au pas/trot", "Transitions trot-galop", "Travail sur le cercle, incurvation", "Retour au calme au pas"],
      ["Échauffement avec changements de direction", "Transitions descendantes répétées", "Travail en serpentine", "Étirements en fin de séance"],
    ],
  },
  ASSOUPLISSEMENT: {
    title: "Dressage — assouplissements",
    focus: "Souplesse & écoute",
    baseDurationMin: 45,
    exerciseVariants: [
      ["Étirements à pied avant le travail monté", "Épaule en dedans au pas", "Appuyers au trot", "Reculer et immobilité"],
      ["Travail sur des courbes variées", "Cession à la jambe", "Transitions au sein de l'allure", "Pas allongé en fin de séance"],
    ],
  },
  BARRES_AU_SOL: {
    title: "Obstacle — barres au sol",
    focus: "Précision & équilibre",
    baseDurationMin: 40,
    exerciseVariants: [
      ["Échauffement avec barres au sol", "Ligne de barres, distances variées", "Travail sans étriers", "Retour au calme"],
      ["Barres en éventail", "Travail sur la régularité de l'allure", "Cavalettis au trot", "Retour au pas, étirements"],
    ],
  },
  OBSTACLE: {
    title: "Obstacle — sauts",
    focus: "Technique de saut",
    baseDurationMin: 45,
    exerciseVariants: [
      ["Échauffement avec barres au sol", "Petits sauts techniques", "Ligne d'obstacles à enchaîner", "Retour au calme"],
      ["Échauffement progressif", "Travail de la foulée avant l'obstacle", "Enchaînement avec changements de main", "Retour au calme"],
    ],
  },
  SORTIE_EXTERIEURE: {
    title: "Sortie extérieure",
    focus: "Endurance & mental",
    baseDurationMin: 60,
    exerciseVariants: [
      ["Marche en extérieur", "Trot enlevé sur terrain plat", "Galop sur ligne droite sécurisée", "Retour au pas, étirements"],
      ["Marche en terrain varié", "Trot assis sur de longues lignes", "Franchissement d'obstacles naturels (fossé, talus)", "Retour au calme"],
    ],
  },
  TRAVAIL_A_PIED: {
    title: "Travail à pied",
    focus: "Complicité & écoute",
    baseDurationMin: 30,
    exerciseVariants: [
      ["Pansage et observation du cheval", "Exercices de respect des distances", "Travail en longe ou en liberté", "Moment de détente ensemble"],
      ["Désensibilisation à des objets nouveaux", "Exercices de mène en main", "Travail des transitions à pied", "Temps calme partagé"],
    ],
  },
  RENFORCEMENT: {
    title: "Renforcement musculaire",
    focus: "Tonicité & équilibre",
    baseDurationMin: 40,
    exerciseVariants: [
      ["Échauffement progressif", "Transitions fréquentes pour l'engagement", "Travail sur terrain varié si possible", "Étirements en fin de séance"],
      ["Travail en côte si le terrain le permet", "Exercices de reculer", "Cercles resserrés au pas et au trot", "Retour au calme"],
    ],
  },
  RECUPERATION: {
    title: "Récupération active",
    focus: "Détente & observation",
    baseDurationMin: 30,
    exerciseVariants: [
      ["Marche en main", "Étirements doux", "Observation de la locomotion", "Pas de travail monté tant que la forme n'est pas meilleure"],
      ["Pansage prolongé", "Marche en liberté au paddock", "Observation du comportement", "Bilan avec le vétérinaire/ostéopathe si besoin"],
    ],
  },
};

/** Restrictions spécifiques par condition de santé déclarée — seules les
 * conditions ayant un impact connu sur l'effort/l'impact articulaire ont une
 * règle ; les autres (allergies, coliques...) restent un point de vigilance
 * sans restriction d'exercice (cf. buildPersonalizationNotes). */
const HEALTH_CONDITION_RULES: Record<string, { excludeTypes: SessionType[]; maxIntensity?: SessionIntensity; note: string }> = {
  Arthrose: {
    excludeTypes: ["OBSTACLE"],
    maxIntensity: "MEDIUM",
    note: "Arthrose signalée : travail de saut écarté, échauffement plus long recommandé.",
  },
  Fourbure: {
    excludeTypes: ["OBSTACLE", "BARRES_AU_SOL"],
    maxIntensity: "MEDIUM",
    note: "Fourbure signalée : travail à fort impact écarté, terrain souple à privilégier.",
  },
  "Tendinite chronique": {
    excludeTypes: ["OBSTACLE"],
    maxIntensity: "MEDIUM",
    note: "Tendinite chronique signalée : travail de saut écarté par précaution.",
  },
  "Problème de dos": {
    excludeTypes: ["OBSTACLE"],
    maxIntensity: "MEDIUM",
    note: "Problème de dos signalé : saut écarté ; pense à faire vérifier la selle et l'équilibre du cavalier.",
  },
  "Problème de pieds / sabots": {
    excludeTypes: ["OBSTACLE"],
    maxIntensity: "MEDIUM",
    note: "Problème de pieds/sabots signalé : terrain dur à éviter, saut écarté par précaution.",
  },
  "Souffle / problème respiratoire": {
    excludeTypes: [],
    maxIntensity: "MEDIUM",
    note: "Problème respiratoire signalé : intensité plafonnée, surveille l'essoufflement à l'effort.",
  },
  "Problème de vue": {
    excludeTypes: ["OBSTACLE"],
    note: "Problème de vue signalé : terrain connu à privilégier, saut écarté par précaution.",
  },
};

/** Notes de personnalisation positives selon le tempérament déclaré — pas un
 * risque, juste une façon d'adapter l'approche à la personnalité du cheval. */
const TEMPERAMENT_NOTES: Record<string, string> = {
  Calme: "Tempérament calme : on peut introduire de la nouveauté sans crainte de réaction excessive.",
  Sensible: "Tempérament sensible : transitions adoucies, aides progressives.",
  Joueur: "Tempérament joueur : un échauffement plus long pour canaliser l'énergie avant le travail sérieux.",
  Craintif: "Tempérament craintif : nouveautés introduites très progressivement, en terrain connu.",
  Téméraire: "Tempérament téméraire : vigilance sur la prise de risques, notamment en extérieur.",
  Affectueux: "Tempérament affectueux : les moments de travail à pied renforcent encore la relation.",
  Dominant: "Tempérament dominant : limites claires posées dès le début de chaque séance.",
  Sociable: "Tempérament sociable : le travail en présence d'autres chevaux est plutôt un atout.",
  Indépendant: "Tempérament indépendant : la complicité se construit surtout par la régularité, pas la contrainte.",
  Méfiant: "Tempérament méfiant : prendre le temps de la mise en confiance avant chaque nouvel exercice.",
  Curieux: "Tempérament curieux : varier les exercices entretient sa motivation.",
  Têtu: "Tempérament têtu : varier les approches évite les blocages et la lassitude.",
};

function computeSessionsPerWeek(rider: RiderProfile, horse: Horse): { count: number; notes: string[] } {
  const notes: string[] = [];
  const riderWish = rider.rideFrequency ? RIDER_FREQUENCY_SESSIONS[rider.rideFrequency] : 3;
  const horseCap = horse.workload ? WORKLOAD_CAP[horse.workload] : 4;
  let count = Math.min(riderWish, horseCap);

  if (horse.fitnessLevel === "RESTING") {
    count = Math.min(count, 2);
    notes.push(
      `${horse.name} est actuellement au repos : programme allégé à ${count} séance(s)/semaine, travail léger uniquement.`
    );
  } else if (horse.fitnessLevel === "REOPENING") {
    count = Math.min(count, 3);
  }

  return { count: Math.max(1, count), notes };
}

function computeBaseIntensity(
  riderLevel: RiderLevel | null,
  horseLevel: HorseLevel,
  fitnessLevel: HorseFitnessLevel | null
): SessionIntensity {
  const riderScore = riderLevel ? RIDER_LEVEL_SCORE[riderLevel] : 2;
  const horseScore = HORSE_LEVEL_SCORE[horseLevel];
  const fitnessScore = fitnessLevel ? FITNESS_SCORE[fitnessLevel] : FITNESS_SCORE.GOOD;

  if (fitnessScore <= 1) return "LOW";
  // le niveau du binôme est tiré vers le bas par le moins expérimenté des deux
  const competence = Math.min(riderScore, horseScore + 1);
  if (competence <= 2) return "LOW";
  if (competence <= 3) return "MEDIUM";
  return fitnessScore >= 3 ? "HIGH" : "MEDIUM";
}

function applyGoalBias(pool: SessionType[], goal: RiderGoal | null): SessionType[] {
  const preferred = goal ? GOAL_PREFERRED_TYPE[goal] : undefined;
  if (!preferred) return pool;
  // Injecte le type préféré même s'il n'appartient pas au pool technique de la
  // discipline : BONDING/CONFIDENCE/FITNESS doivent pouvoir imposer du travail
  // à pied ou du renforcement même en CSO/dressage pur.
  return [preferred, ...pool.filter((t) => t !== preferred)];
}

function capAt(current: SessionIntensity, max: SessionIntensity): SessionIntensity {
  return INTENSITY_ORDER.indexOf(current) > INTENSITY_ORDER.indexOf(max) ? max : current;
}

type InjuryCaution = "NONE" | "ACTIVE" | "MONITOR";

/** ACTIVE = récupération en cours (le plus prudent) ; MONITOR = séquelle
 * connue ou retour récent d'une blessure "rétablie" (< ~8 semaines) ; NONE =
 * rétablie depuis longtemps, aucune restriction. */
function injuryCautionLevel(injury: Injury): InjuryCaution {
  if (injury.recoveryStatus === "IN_PROGRESS") return "ACTIVE";
  if (injury.recoveryStatus === "ONGOING") return "MONITOR";
  if (!injury.occurredAt) return "NONE";
  const daysSince = (Date.now() - injury.occurredAt.getTime()) / 86_400_000;
  return daysSince < RECENT_RECOVERY_WINDOW_DAYS ? "MONITOR" : "NONE";
}

function injuryNote(injury: Injury, level: InjuryCaution): string {
  if (level === "ACTIVE") {
    return `${injury.type} en cours de récupération : travail très progressif, saut et barres au sol écartés tant que la récupération n'est pas terminée.`;
  }
  return `${injury.type} à surveiller (séquelle ou retour récent) : travail de saut écarté par précaution.`;
}

/** Applique en une passe les restrictions de santé ET de blessures sur le
 * pool de types de séances et le plafond d'intensité, et collecte les notes
 * explicatives associées (affichées au cavalier). */
function applyHealthAndInjuryRestrictions(
  pool: SessionType[],
  baseIntensity: SessionIntensity,
  horse: Horse
): { pool: SessionType[]; intensity: SessionIntensity; notes: string[] } {
  const notes: string[] = [];
  let nextPool = pool;
  let nextIntensity = baseIntensity;

  for (const condition of horse.healthConditions) {
    const rule = HEALTH_CONDITION_RULES[condition];
    if (!rule) continue;
    nextPool = nextPool.filter((t) => !rule.excludeTypes.includes(t));
    if (rule.maxIntensity) nextIntensity = capAt(nextIntensity, rule.maxIntensity);
    notes.push(rule.note);
  }

  for (const injury of horse.injuries) {
    const level = injuryCautionLevel(injury);
    if (level === "NONE") continue;
    nextPool = nextPool.filter((t) => t !== "OBSTACLE" && !(level === "ACTIVE" && t === "BARRES_AU_SOL"));
    nextIntensity = capAt(nextIntensity, level === "ACTIVE" ? "LOW" : "MEDIUM");
    notes.push(injuryNote(injury, level));
  }

  return {
    pool: nextPool.length > 0 ? nextPool : ["TRAVAIL_A_PIED", "RECUPERATION"],
    intensity: nextIntensity,
    notes,
  };
}

/** Découpe le programme en 3 phases : reprise (intensité allégée), développement
 * (intensité de base), affirmation (intensité relevée, seulement pour les
 * objectifs orientés performance, en fin de programme). */
function phaseForWeek(weekNumber: number, totalWeeks: number, goal: RiderGoal | null): ProgramPhase {
  const repriseLen = Math.max(1, Math.round(totalWeeks * 0.2));
  const hasAffirmation = goal === "COMPETE" || goal === "EVENT_PREP";
  const affirmationLen = hasAffirmation ? Math.max(1, Math.round(totalWeeks * 0.15)) : 0;

  if (weekNumber <= repriseLen) return "REPRISE";
  if (affirmationLen > 0 && weekNumber > totalWeeks - affirmationLen) return "AFFIRMATION";
  return "DEVELOPPEMENT";
}

function intensityForPhase(base: SessionIntensity, phase: ProgramPhase): SessionIntensity {
  const idx = INTENSITY_ORDER.indexOf(base);
  if (phase === "REPRISE") return INTENSITY_ORDER[Math.max(0, idx - 1)];
  if (phase === "AFFIRMATION") return INTENSITY_ORDER[Math.min(INTENSITY_ORDER.length - 1, idx + 1)];
  return base;
}

function scaleDuration(baseMin: number, intensity: SessionIntensity): number {
  const factor = intensity === "LOW" ? 0.8 : intensity === "HIGH" ? 1.2 : 1;
  return Math.round((baseMin * factor) / 5) * 5;
}

/** Répartit `count` séances sur les 7 jours de la semaine, le plus
 * régulièrement possible (lundi = 0). */
function spreadDays(count: number): number[] {
  const n = Math.min(7, Math.max(1, count));
  const days = new Set<number>();
  for (let i = 0; i < n; i++) days.add(Math.round((i * 7) / n) % 7);
  return Array.from(days).sort((a, b) => a - b);
}

/** Pioche un élément d'une liste en rotation déterministe sur l'index donné —
 * utilisé pour faire tourner points faibles et variantes d'exercices au fil
 * des semaines plutôt que de toujours utiliser le premier. */
function rotate<T>(list: T[], index: number): T | undefined {
  if (list.length === 0) return undefined;
  return list[index % list.length];
}

function buildExercises(type: SessionType, weekIndex: number, horse: Horse): string[] {
  const meta = SESSION_META[type];
  const variant = rotate(meta.exerciseVariants, weekIndex) ?? meta.exerciseVariants[0];

  const technical: SessionType[] = ["DRESSAGE_BASICS", "OBSTACLE", "BARRES_AU_SOL"];
  if (!technical.includes(type)) return variant;

  const weakness = rotate(horse.weaknesses, weekIndex);
  if (!weakness) return variant;
  return [...variant, `Travail ciblé sur le point faible signalé : ${weakness.toLowerCase()}`];
}

function buildPersonalizationNotes(rider: RiderProfile, horse: Horse): string[] {
  const notes = horse.temperament.map((t) => TEMPERAMENT_NOTES[t]).filter((n): n is string => Boolean(n));

  if (horse.birthYear) {
    const age = new Date().getFullYear() - horse.birthYear;
    if (age <= 4) notes.push(`${horse.name} a ${age} ans : encore jeune, on privilégie la régularité à l'intensité.`);
    else if (age >= 16) notes.push(`${horse.name} a ${age} ans : attention particulière à l'échauffement et à la récupération.`);
  }

  if (horse.sex === "STALLION") {
    notes.push("Cheval entier : vigilance accrue à proximité d'autres chevaux, en sortie ou en concours.");
  } else if (horse.sex === "MARE") {
    notes.push(
      "Jument : des variations de comportement liées aux chaleurs sont normales certaines semaines — adapte la patience plutôt que l'intensité."
    );
  }

  if (horse.strengths.length > 0) {
    notes.push(
      `Point(s) fort(s) à exploiter : ${horse.strengths.join(", ").toLowerCase()} — à valoriser pour construire la confiance.`
    );
  }

  const minorHealthNotes = horse.healthConditions
    .filter((c) => c !== NO_HEALTH_CONDITION && !HEALTH_CONDITION_RULES[c])
    .map((c) => `Point de vigilance signalé : ${c.toLowerCase()}.`);

  if (rider.mainDiscipline && rider.mainDiscipline !== horse.discipline) {
    const riderLabel = DISCIPLINES.find((d) => d.value === rider.mainDiscipline)?.label ?? rider.mainDiscipline;
    const horseLabel = DISCIPLINES.find((d) => d.value === horse.discipline)?.label ?? horse.discipline;
    notes.push(
      `Ta discipline principale (${riderLabel}) diffère de celle de ${horse.name} (${horseLabel}) : ce programme suit celle de ${horse.name}.`
    );
  }

  return [...notes, ...minorHealthNotes];
}

function programTitle(horse: Horse): string {
  const disciplineLabel = DISCIPLINES.find((d) => d.value === horse.discipline)?.label ?? horse.discipline;
  return `Programme de ${horse.name} — ${disciplineLabel}`;
}

function programTheme(rider: RiderProfile): string {
  return rider.primaryGoal ? GOAL_THEME[rider.primaryGoal] : "Progresser ensemble, à votre rythme.";
}

export function generateProgram(rider: RiderProfile, horse: Horse): GeneratedProgram {
  const safetyNotes: string[] = [];

  const { count: sessionsPerWeek, notes: frequencyNotes } = computeSessionsPerWeek(rider, horse);
  safetyNotes.push(...frequencyNotes);

  const basePool = DISCIPLINE_POOL[horse.discipline] ?? DISCIPLINE_POOL.LEISURE;
  const biasedPool = applyGoalBias(basePool, rider.primaryGoal);
  const baseIntensity = computeBaseIntensity(rider.level, horse.level, horse.fitnessLevel);

  const {
    pool: safePool,
    intensity: cappedBaseIntensity,
    notes: restrictionNotes,
  } = applyHealthAndInjuryRestrictions(biasedPool, baseIntensity, horse);
  safetyNotes.push(...restrictionNotes);

  const days = spreadDays(sessionsPerWeek);
  // type fixé par jour (même créneau = même type chaque semaine, prévisible
  // pour le cavalier) ; seuls l'intensité, l'exercice et le point faible
  // ciblé varient semaine après semaine.
  const dayTypes = days.map((dayOffset, i) => ({ dayOffset, type: safePool[i % safePool.length] }));

  const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => {
    const weekNumber = i + 1;
    const phase = phaseForWeek(weekNumber, TOTAL_WEEKS, rider.primaryGoal);
    const weekIntensity = intensityForPhase(cappedBaseIntensity, phase);

    const sessions: SessionTemplate[] = dayTypes.map(({ dayOffset, type }) => {
      const meta = SESSION_META[type];
      return {
        dayOffset,
        time: dayOffset >= 5 ? "10h00" : "18h00",
        type,
        title: meta.title,
        durationMin: scaleDuration(meta.baseDurationMin, weekIntensity),
        focus: meta.focus,
        intensity: weekIntensity,
        exercises: buildExercises(type, weekNumber - 1, horse),
      };
    });

    return { weekNumber, phase, sessions };
  });

  return {
    title: programTitle(horse),
    theme: programTheme(rider),
    totalWeeks: TOTAL_WEEKS,
    sessionsPerWeek,
    weeks,
    personalizationNotes: buildPersonalizationNotes(rider, horse),
    safetyNotes,
    generatedAt: new Date().toISOString(),
  };
}
