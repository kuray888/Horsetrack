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
import type {
  ExerciseStep,
  FeedbackTrend,
  GeneratedProgram,
  ProgramPhase,
  SessionIntensity,
  SessionStepPhase,
  SessionTemplate,
  SessionType,
} from "./types";

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

type ExerciseStepDraft = { phase: SessionStepPhase; title: string; description: string };

/** 2 variantes par type pour qu'une même séance ne soit pas identique à
 * chaque occurrence dans le programme. Chaque exercice porte une description
 * (comment le faire / à quoi veiller) et une phase d'affichage. */
const SESSION_META: Record<
  SessionType,
  { title: string; focus: string; baseDurationMin: number; exerciseVariants: ExerciseStepDraft[][] }
> = {
  DRESSAGE_BASICS: {
    title: "Dressage — bases",
    focus: "Engagement & rectitude",
    baseDurationMin: 45,
    exerciseVariants: [
      [
        {
          phase: "ECHAUFFEMENT",
          title: "Échauffement progressif au pas/trot",
          description: "Mets le cheval en mouvement en douceur, pas puis trot, pour préparer muscles et articulations avant le travail technique.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Transitions trot-galop",
          description: "Enchaîne des transitions nettes entre trot et galop pour développer l'engagement des postérieurs et la réactivité aux aides.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Travail sur le cercle, incurvation",
          description: "Trace des cercles réguliers en cherchant une incurvation homogène du cheval autour de ta jambe intérieure.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "Retour au calme au pas",
          description: "Termine au pas, rênes longues, pour faire redescendre la fréquence cardiaque et étirer le dos du cheval.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "Échauffement avec changements de direction",
          description: "Alterne les changements de direction au pas et au trot pour réveiller l'attention du cheval avant d'aborder le travail plus précis.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Transitions descendantes répétées",
          description: "Répète des transitions descendantes (galop-trot, trot-pas) en cherchant à garder l'équilibre et la rectitude à chaque fois.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Travail en serpentine",
          description: "Enchaîne des serpentines au trot pour travailler la souplesse latérale et l'écoute aux aides de direction.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "Étirements en fin de séance",
          description: "Termine par quelques minutes au pas en étirant l'encolure vers le bas pour relâcher le dos.",
        },
      ],
    ],
  },
  ASSOUPLISSEMENT: {
    title: "Dressage — assouplissements",
    focus: "Souplesse & écoute",
    baseDurationMin: 45,
    exerciseVariants: [
      [
        {
          phase: "ECHAUFFEMENT",
          title: "Étirements à pied avant le travail monté",
          description: "Quelques minutes de marche en main avec étirements doux pour préparer le cheval avant de monter.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Épaule en dedans au pas",
          description: "Demande un léger épaule en dedans au pas pour travailler la mobilité des épaules et l'engagement de l'arrière-main.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Appuyers au trot",
          description: "Travaille des appuyers au trot sur quelques mètres pour développer la dissociation avant/arrière et la décontraction.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "Reculer et immobilité",
          description: "Termine par des reculers calmes suivis d'un temps d'immobilité pour renforcer l'écoute et la patience.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "Travail sur des courbes variées",
          description: "Varie les courbes (grands cercles, voltes) au pas et au trot pour assouplir progressivement le cheval.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Cession à la jambe",
          description: "Travaille la cession à la jambe au pas puis au trot pour affiner la réactivité aux aides latérales.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Transitions au sein de l'allure",
          description: "Alterne les amplitudes au sein d'une même allure (trot rassemblé/trot moyen) pour développer l'élasticité du dos.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "Pas allongé en fin de séance",
          description: "Termine par du pas allongé, rênes longues, pour détendre le cheval après le travail technique.",
        },
      ],
    ],
  },
  BARRES_AU_SOL: {
    title: "Obstacle — barres au sol",
    focus: "Précision & équilibre",
    baseDurationMin: 40,
    exerciseVariants: [
      [
        {
          phase: "ECHAUFFEMENT",
          title: "Échauffement avec barres au sol",
          description: "Passe sur une barre isolée au pas puis au trot pour réveiller la précision des postérieurs avant l'exercice principal.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Ligne de barres, distances variées",
          description: "Enchaîne une ligne de barres avec des distances variées pour travailler la régularité de la foulée.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Travail sans étriers",
          description: "Reprends quelques minutes de trot sans étriers pour renforcer ton assiette et ta stabilité.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "Retour au calme",
          description: "Termine au pas en laissant le cheval s'étirer, en valorisant le travail accompli.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "Barres en éventail",
          description: "Aborde des barres en éventail pour travailler la précision sur des distances qui se resserrent ou s'élargissent.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Travail sur la régularité de l'allure",
          description: "Maintiens une cadence stable au trot entre les barres pour développer la régularité et l'équilibre du cheval.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Cavalettis au trot",
          description: "Enchaîne quelques cavalettis bas au trot pour développer la technique des membres sans la contrainte du saut.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "Retour au pas, étirements",
          description: "Reviens au pas, rênes longues, et laisse le cheval s'étirer encolure basse pour décontracter le dos.",
        },
      ],
    ],
  },
  OBSTACLE: {
    title: "Obstacle — sauts",
    focus: "Technique de saut",
    baseDurationMin: 45,
    exerciseVariants: [
      [
        {
          phase: "ECHAUFFEMENT",
          title: "Échauffement avec barres au sol",
          description: "Commence par des barres au sol au trot pour affiner la précision avant d'introduire le saut.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Petits sauts techniques",
          description: "Travaille quelques petits obstacles isolés en variant les abords pour développer la technique de saut.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Ligne d'obstacles à enchaîner",
          description: "Enchaîne une ligne de 2-3 obstacles bas pour travailler le rythme et la régularité entre les efforts.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "Retour au calme",
          description: "Termine au pas, en valorisant le cheval, pour redescendre progressivement l'intensité.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "Échauffement progressif",
          description: "Échauffe le cheval au pas puis au trot avec quelques transitions pour le préparer mentalement et physiquement au saut.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Travail de la foulée avant l'obstacle",
          description: "Travaille l'ajustement de la foulée à l'approche d'un obstacle isolé pour affiner ton sens du rythme.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Enchaînement avec changements de main",
          description: "Enchaîne plusieurs obstacles avec des changements de main pour travailler la maniabilité et l'anticipation.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "Retour au calme",
          description: "Termine par un retour au pas calme, en récompensant le cheval pour le travail fourni.",
        },
      ],
    ],
  },
  SORTIE_EXTERIEURE: {
    title: "Sortie extérieure",
    focus: "Endurance & mental",
    baseDurationMin: 60,
    exerciseVariants: [
      [
        {
          phase: "ECHAUFFEMENT",
          title: "Marche en extérieur",
          description: "Démarre par une marche tranquille en extérieur pour mettre le cheval en confiance et chauffer les muscles progressivement.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Trot enlevé sur terrain plat",
          description: "Enchaîne du trot enlevé sur terrain plat pour travailler l'endurance sans solliciter excessivement le dos.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Galop sur ligne droite sécurisée",
          description: "Si le terrain le permet, propose un galop tranquille sur une ligne droite dégagée et sécurisée.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "Retour au pas, étirements",
          description: "Termine au pas en laissant le cheval s'étirer pour bien récupérer avant le retour.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "Marche en terrain varié",
          description: "Marche sur un terrain varié (montées, descentes légères) pour solliciter en douceur différents groupes musculaires.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Trot assis sur de longues lignes",
          description: "Travaille le trot assis sur de longues lignes pour développer ton équilibre et l'endurance du cheval.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Franchissement d'obstacles naturels (fossé, talus)",
          description: "Aborde calmement un obstacle naturel (fossé, talus) pour développer la confiance et l'aisance en extérieur.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "Retour au calme",
          description: "Termine par une marche calme pour permettre une bonne récupération avant le retour à l'écurie.",
        },
      ],
    ],
  },
  TRAVAIL_A_PIED: {
    title: "Travail à pied",
    focus: "Complicité & écoute",
    baseDurationMin: 30,
    exerciseVariants: [
      [
        {
          phase: "ECHAUFFEMENT",
          title: "Pansage et observation du cheval",
          description: "Profite du pansage pour observer l'état général du cheval (locomotion, moral, sensibilités) avant de commencer.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Exercices de respect des distances",
          description: "Travaille le respect de l'espace personnel en menant le cheval avec des arrêts/départs nets.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Travail en longe ou en liberté",
          description: "Propose un temps de longe ou de liberté pour observer les allures et renforcer la communication par la voix/le corps.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "Moment de détente ensemble",
          description: "Termine par un moment calme, sans exigence, pour renforcer simplement la relation.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "Désensibilisation à des objets nouveaux",
          description: "Présente calmement un objet nouveau (bâche, plot, ballon) en laissant le cheval l'explorer à son rythme.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Exercices de mène en main",
          description: "Travaille les changements de direction et d'allure en main pour affiner l'écoute du cheval.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Travail des transitions à pied",
          description: "Demande des transitions (arrêt/marche/reculer) en main pour renforcer la précision des réponses.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "Temps calme partagé",
          description: "Termine par un moment sans exercice, juste présence et calme partagés.",
        },
      ],
    ],
  },
  RENFORCEMENT: {
    title: "Renforcement musculaire",
    focus: "Tonicité & équilibre",
    baseDurationMin: 40,
    exerciseVariants: [
      [
        {
          phase: "ECHAUFFEMENT",
          title: "Échauffement progressif",
          description: "Échauffe le cheval au pas puis au trot, en augmentant progressivement l'amplitude avant le travail de fond.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Transitions fréquentes pour l'engagement",
          description: "Multiplie les transitions (pas-trot-pas) pour développer l'engagement des postérieurs et la tonicité générale.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Travail sur terrain varié si possible",
          description: "Si le terrain le permet, intègre des passages en légère pente pour solliciter davantage la musculature.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "Étirements en fin de séance",
          description: "Termine par des étirements au pas pour relâcher les muscles sollicités pendant la séance.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "Travail en côte si le terrain le permet",
          description: "Utilise une côte douce pour renforcer l'arrière-main, au pas puis éventuellement au trot.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Exercices de reculer",
          description: "Travaille le reculer en ligne droite pour développer la force et la coordination de l'arrière-main.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Cercles resserrés au pas et au trot",
          description: "Propose des cercles plus resserrés pour solliciter l'engagement et l'équilibre latéral.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "Retour au calme",
          description: "Termine par un pas détendu pour permettre une bonne récupération musculaire.",
        },
      ],
    ],
  },
  RECUPERATION: {
    title: "Récupération active",
    focus: "Détente & observation",
    baseDurationMin: 30,
    exerciseVariants: [
      [
        {
          phase: "ECHAUFFEMENT",
          title: "Marche en main",
          description: "Sors le cheval en marche en main, sans monter, pour favoriser une circulation douce sans charge.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Étirements doux",
          description: "Propose des étirements doux de l'encolure si le cheval est à l'aise, sans forcer.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Observation de la locomotion",
          description: "Observe attentivement la façon dont le cheval se déplace pour repérer toute gêne ou amélioration.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "Pas de travail monté tant que la forme n'est pas meilleure",
          description: "Laisse le travail monté de côté jusqu'à ce que la forme du cheval le permette à nouveau — la prudence prime.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "Pansage prolongé",
          description: "Prends le temps d'un pansage complet et minutieux, bon moment de contact sans aucune exigence physique.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Marche en liberté au paddock",
          description: "Laisse le cheval se mouvoir librement au paddock pour un mouvement naturel et non contraint.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Observation du comportement",
          description: "Observe le comportement général (appétit, moral, façon de se déplacer) pour suivre l'évolution de sa forme.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "Bilan avec le vétérinaire/ostéopathe si besoin",
          description: "Si un doute persiste sur la récupération, un point avec le vétérinaire ou l'ostéopathe est recommandé avant de reprendre le travail.",
        },
      ],
    ],
  },
};

/** Matériel typiquement nécessaire selon le type de séance — déduit
 * automatiquement, affiché au cavalier pour préparer la séance en amont. */
const SESSION_EQUIPMENT: Record<SessionType, string[]> = {
  DRESSAGE_BASICS: ["Aucun matériel particulier"],
  ASSOUPLISSEMENT: ["Aucun matériel particulier"],
  BARRES_AU_SOL: ["4 à 6 barres au sol", "Plots ou soucoupes pour matérialiser les distances"],
  OBSTACLE: ["Barres au sol", "2 à 3 obstacles bas (cavalettis ou croisillons)", "Plots de matérialisation"],
  SORTIE_EXTERIEURE: ["Protections de travail (guêtres ou protège-boulets)", "Tenue adaptée à la météo"],
  TRAVAIL_A_PIED: ["Licol et longe (ou caveçon)", "Stick ou chambrière si besoin", "Objet de désensibilisation selon l'exercice du jour"],
  RENFORCEMENT: ["Aucun matériel obligatoire", "Terrain varié en option (côte, sol meuble)"],
  RECUPERATION: ["Aucun matériel — privilégier le confort du cheval"],
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

/** Types de séance dans lesquels il est pertinent de travailler concrètement
 * un point faible déclaré — un point faible "Saut" n'a rien à faire sur une
 * séance de dressage à plat sans matériel d'obstacle, par exemple. Les tags
 * absents de cette table (Mental, Gestion du stress, Concentration...) sont
 * transversaux : pertinents quel que soit le type de séance technique. */
const WEAKNESS_RELEVANT_TYPES: Partial<Record<string, SessionType[]>> = {
  "Dressage à plat": ["DRESSAGE_BASICS", "ASSOUPLISSEMENT"],
  Saut: ["OBSTACLE", "BARRES_AU_SOL"],
  "Contact / bouche": ["DRESSAGE_BASICS", "ASSOUPLISSEMENT", "OBSTACLE"],
  Impulsion: ["DRESSAGE_BASICS", "RENFORCEMENT"],
  Planeur: ["DRESSAGE_BASICS", "ASSOUPLISSEMENT"],
  Endurance: ["SORTIE_EXTERIEURE", "RENFORCEMENT"],
  Souplesse: ["ASSOUPLISSEMENT", "DRESSAGE_BASICS"],
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

/** Blessures sans lien avec l'aptitude au saut ou l'impact articulaire — une
 * colique ou une plaie superficielle ne justifient pas d'écarter le saut
 * comme le ferait une tendinite ou une fracture ; seule la prudence sur
 * l'intensité générale reste de mise. Tout type non répertorié ici (y
 * compris "Autre" en texte libre) reste traité par défaut comme à risque
 * articulaire/orthopédique, par prudence faute d'information. */
const NON_MUSCULOSKELETAL_INJURY_TYPES = new Set([
  "Colique",
  "Problème respiratoire",
  "Plaie / blessure superficielle",
]);

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

function injuryNote(injury: Injury, level: InjuryCaution, isMusculoskeletal: boolean): string {
  if (!isMusculoskeletal) {
    return level === "ACTIVE"
      ? `${injury.type} en cours de récupération : travail très progressif en attendant la guérison complète.`
      : `${injury.type} à surveiller (séquelle ou retour récent) : intensité modérée par précaution.`;
  }
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
    const isMusculoskeletal = !NON_MUSCULOSKELETAL_INJURY_TYPES.has(injury.type);
    if (isMusculoskeletal) {
      nextPool = nextPool.filter((t) => t !== "OBSTACLE" && !(level === "ACTIVE" && t === "BARRES_AU_SOL"));
    }
    nextIntensity = capAt(nextIntensity, level === "ACTIVE" ? "LOW" : "MEDIUM");
    notes.push(injuryNote(injury, level, isMusculoskeletal));
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

function intensityFactor(intensity: SessionIntensity): number {
  return intensity === "LOW" ? 0.8 : intensity === "HIGH" ? 1.2 : 1;
}

function scaleDuration(baseMin: number, intensity: SessionIntensity): number {
  return Math.round((baseMin * intensityFactor(intensity)) / 5) * 5;
}

/** Décale une intensité d'un cran selon le ressenti réel des dernières
 * séances (cf. progress/store.tsx + program/store.tsx), en restant dans les
 * bornes LOW..HIGH. */
export function shiftIntensity(intensity: SessionIntensity, trend: FeedbackTrend): SessionIntensity {
  const idx = INTENSITY_ORDER.indexOf(intensity) + trend;
  return INTENSITY_ORDER[Math.max(0, Math.min(INTENSITY_ORDER.length - 1, idx))];
}

/** Réajuste une durée déjà calculée pour `fromIntensity` à ce qu'elle serait
 * pour `toIntensity` — utilisé quand `shiftIntensity` change l'intensité
 * d'une séance déjà générée (dont on n'a plus la durée de base du type). */
export function rescaleDuration(
  currentDurationMin: number,
  fromIntensity: SessionIntensity,
  toIntensity: SessionIntensity
): number {
  if (fromIntensity === toIntensity) return currentDurationMin;
  return Math.round((currentDurationMin * intensityFactor(toIntensity)) / intensityFactor(fromIntensity) / 5) * 5;
}

/** Jours samedi/dimanche (dayOffset : 0 = lundi) — seule la fréquence "Le
 * week-end" contraint des jours précis ; les autres fréquences n'imposent
 * qu'un nombre de séances et restent libres sur toute la semaine. */
const WEEKEND_DAYS = [5, 6];

/** Répartit `count` séances le plus régulièrement possible sur les jours
 * disponibles — toute la semaine par défaut, ou seulement `allowedDays` si
 * fourni (cf. WEEKEND_DAYS : un cavalier qui ne monte "que le week-end" ne
 * doit jamais se voir caler une séance un lundi ou un vendredi). */
function spreadDays(count: number, allowedDays?: number[]): number[] {
  const pool = allowedDays && allowedDays.length > 0 ? allowedDays : [0, 1, 2, 3, 4, 5, 6];
  const n = Math.min(pool.length, Math.max(1, count));
  const days = new Set<number>();
  for (let i = 0; i < n; i++) days.add(pool[Math.round((i * pool.length) / n) % pool.length]);
  return Array.from(days).sort((a, b) => a - b);
}

/** Pioche un élément d'une liste en rotation déterministe sur l'index donné —
 * utilisé pour faire tourner points faibles et variantes d'exercices au fil
 * des semaines plutôt que de toujours utiliser le premier. */
function rotate<T>(list: T[], index: number): T | undefined {
  if (list.length === 0) return undefined;
  return list[index % list.length];
}

/** Charge technique/physique relative de chaque type de séance — sert à
 * ordonner les jours de la semaine plutôt que de caler les types dans
 * l'ordre brut du pool de discipline. Sans ça, un cavalier CSO démarre parfois
 * sa semaine par une séance de saut (premier type du pool SHOW_JUMPING) :
 * pas pertinent pédagogiquement, une semaine cohérente monte en charge plutôt
 * que de placer le pic d'effort dès le premier jour. */
const SESSION_LOAD: Record<SessionType, number> = {
  TRAVAIL_A_PIED: 0,
  RECUPERATION: 0,
  ASSOUPLISSEMENT: 1,
  DRESSAGE_BASICS: 1,
  RENFORCEMENT: 2,
  BARRES_AU_SOL: 2,
  SORTIE_EXTERIEURE: 2,
  OBSTACLE: 3,
};

/** Associe les jours retenus à des types de séance : la sélection (quels
 * types, combien de fois chacun) reste pilotée par le pool de discipline +
 * biais d'objectif (cf. applyGoalBias), mais l'ordre CHRONOLOGIQUE sur la
 * semaine suit la charge croissante plutôt que l'ordre du pool — pour une
 * progression cohérente. La tranche du pool utilisée avance d'un cran à
 * chaque semaine (`weekIndex`) : sans ça, un cavalier qui ne monte qu'1 ou 2
 * fois par semaine ne verrait jamais que les 1-2 premiers types du pool
 * pendant tout le programme (ex. uniquement de l'obstacle en CSO, jamais de
 * plat) — la rotation garantit que tout le pool est exploré sur la durée du
 * programme plutôt qu'une seule fois pour les 8 semaines. */
function buildDayTypes(
  days: number[],
  pool: SessionType[],
  weekIndex: number
): { dayOffset: number; type: SessionType }[] {
  const selected = days.map((_, i) => pool[(i + weekIndex) % pool.length]);
  const ordered = selected
    .map((type, i) => ({ type, i }))
    .sort((a, b) => SESSION_LOAD[a.type] - SESSION_LOAD[b.type] || a.i - b.i)
    .map(({ type }) => type);
  return days.map((dayOffset, i) => ({ dayOffset, type: ordered[i] }));
}

function buildExercises(type: SessionType, weekIndex: number, horse: Horse): ExerciseStep[] {
  const meta = SESSION_META[type];
  const variant = rotate(meta.exerciseVariants, weekIndex) ?? meta.exerciseVariants[0];

  const technical: SessionType[] = [
    "DRESSAGE_BASICS",
    "OBSTACLE",
    "BARRES_AU_SOL",
    "ASSOUPLISSEMENT",
    "RENFORCEMENT",
    "SORTIE_EXTERIEURE",
  ];
  if (!technical.includes(type)) return variant;

  // Ne cible que les points faibles pertinents pour CE type de séance (cf.
  // WEAKNESS_RELEVANT_TYPES) — un tag transversal (absent de cette table)
  // reste pertinent partout.
  const relevantWeaknesses = horse.weaknesses.filter((w) => {
    const relevantTypes = WEAKNESS_RELEVANT_TYPES[w];
    return !relevantTypes || relevantTypes.includes(type);
  });
  const weakness = rotate(relevantWeaknesses, weekIndex);
  if (!weakness) return variant;
  return [
    ...variant,
    {
      phase: "CORPS_DE_SEANCE",
      title: `Travail ciblé : ${weakness.toLowerCase()}`,
      description: `Accorde une attention particulière à ce point faible signalé pendant la séance, sans le forcer.`,
    },
  ];
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

  const days = spreadDays(sessionsPerWeek, rider.rideFrequency === "WEEKEND" ? WEEKEND_DAYS : undefined);

  const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => {
    const weekNumber = i + 1;
    const phase = phaseForWeek(weekNumber, TOTAL_WEEKS, rider.primaryGoal);
    const weekIntensity = intensityForPhase(cappedBaseIntensity, phase);
    const dayTypes = buildDayTypes(days, safePool, weekNumber - 1);

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
        equipment: SESSION_EQUIPMENT[type],
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
