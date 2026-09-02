import type {
  RiderLevel,
  RideFrequency,
  Discipline,
  RiderGoal,
  HorseSex,
  HorseLevel,
  HorseFitnessLevel,
  HorseWorkload,
  HorseRecoveryStatus,
  PreferredTime,
} from "./store";

/** Nombre d'étapes affichant la barre de progression (welcome/building/paywall exclus). */
export const TOTAL_STEPS = 10;

/** Valeur sentinelle UI pour "option non listée" (race, type de blessure...) — jamais persistée telle quelle. */
export const OTHER_OPTION = "__OTHER__";

/** Libellés FR affichés à l'utilisateur, indexés par la valeur d'enum (= valeur Prisma). */
export type Option<T extends string> = { value: T; label: string; emoji?: string };

export const RIDER_LEVELS: Option<RiderLevel>[] = [
  { value: "BEGINNER", label: "Débutant" },
  { value: "GALOP_1_4", label: "Galop 1 à 4" },
  { value: "GALOP_5_7", label: "Galop 5 à 7" },
  { value: "AMATEUR", label: "Amateur / Club" },
  { value: "PRO", label: "Professionnel" },
];

export const RIDE_FREQUENCIES: Option<RideFrequency>[] = [
  { value: "DAILY", label: "Tous les jours", emoji: "🗓️" },
  { value: "SEVERAL_PER_WEEK", label: "Plusieurs fois par semaine", emoji: "🐎" },
  { value: "WEEKEND", label: "Le week-end", emoji: "☀️" },
  { value: "OCCASIONAL", label: "De temps en temps", emoji: "🌿" },
];

export const PREFERRED_TIMES: Option<PreferredTime>[] = [
  { value: "MORNING", label: "Le matin", emoji: "🌅" },
  { value: "LUNCH", label: "En journée / pause déjeuner", emoji: "🌤️" },
  { value: "EVENING", label: "En fin de journée", emoji: "🌆" },
];

export const DISCIPLINES: Option<Discipline>[] = [
  { value: "SHOW_JUMPING", label: "Saut d'obstacles (CSO)", emoji: "🚧" },
  { value: "DRESSAGE", label: "Dressage", emoji: "🎯" },
  { value: "EVENTING", label: "Concours complet", emoji: "🏅" },
  { value: "WESTERN", label: "Western", emoji: "🤠" },
  { value: "ENDURANCE", label: "Endurance", emoji: "🧭" },
  { value: "LEISURE", label: "Loisir / Balade", emoji: "🌲" },
  { value: "ETHOLOGY", label: "Éthologie", emoji: "🤝" },
];

export const RIDER_GOALS: Option<RiderGoal>[] = [
  { value: "COMPETE", label: "Progresser en concours", emoji: "🏆" },
  { value: "BONDING", label: "Renforcer notre complicité", emoji: "❤️" },
  { value: "FITNESS", label: "Remettre mon cheval en forme", emoji: "💪" },
  { value: "EVENT_PREP", label: "Préparer un événement précis", emoji: "📅" },
  { value: "CONFIDENCE", label: "Reprendre confiance", emoji: "🌟" },
];

export const HORSE_SEXES: Option<HorseSex>[] = [
  { value: "GELDING", label: "Hongre" },
  { value: "MARE", label: "Jument" },
  { value: "STALLION", label: "Entier" },
];

export const HORSE_LEVELS: Option<HorseLevel>[] = [
  { value: "UNTRAINED", label: "Débourré / vert" },
  { value: "CLUB", label: "Niveau club" },
  { value: "AMATEUR", label: "Amateur" },
  { value: "PRO", label: "Professionnel" },
];

/** Tags points forts / points faibles (multi-select, partagés). */
export const HORSE_TRAITS: string[] = [
  "Mental",
  "Dressage à plat",
  "Saut",
  "Contact / bouche",
  "Impulsion",
  "Planeur",
  "Gestion du stress",
  "Concentration",
  "Endurance",
  "Souplesse",
];

/** Races courantes proposées en dropdown — `OTHER_OPTION` ouvre un champ libre. */
export const HORSE_BREEDS: { value: string; label: string }[] = [
  { value: "Selle Français", label: "Selle Français" },
  { value: "Pur-sang anglais", label: "Pur-sang anglais" },
  { value: "Anglo-arabe", label: "Anglo-arabe" },
  { value: "KWPN", label: "KWPN (Hollandais)" },
  { value: "Hanovrien", label: "Hanovrien" },
  { value: "Lusitanien", label: "Lusitanien" },
  { value: "Pure race espagnole", label: "Pure race espagnole (PRE)" },
  { value: "Frison", label: "Frison" },
  { value: "Quarter Horse", label: "Quarter Horse" },
  { value: "Camargue", label: "Camargue" },
  { value: "Comtois", label: "Comtois" },
  { value: "Trait", label: "Cheval de trait" },
  { value: "Connemara", label: "Connemara" },
  { value: "Welsh", label: "Welsh" },
  { value: "Shetland", label: "Shetland" },
  { value: "Arabe", label: "Pur-sang arabe" },
  { value: OTHER_OPTION, label: "Autre / je ne sais pas" },
];

export const HORSE_FITNESS_LEVELS: Option<HorseFitnessLevel>[] = [
  { value: "RESTING", label: "Au repos", emoji: "🌙" },
  { value: "REOPENING", label: "Reprise en main", emoji: "🌱" },
  { value: "GOOD", label: "Bonne forme", emoji: "👍" },
  { value: "PEAK", label: "Forme optimale / compétition", emoji: "🔥" },
];

export const HORSE_WORKLOADS: Option<HorseWorkload>[] = [
  { value: "NONE", label: "Aucun travail actuellement" },
  { value: "ONE_TO_TWO", label: "1-2 jours / semaine" },
  { value: "THREE_TO_FOUR", label: "3-4 jours / semaine" },
  { value: "FIVE_TO_SIX", label: "5-6 jours / semaine" },
  { value: "DAILY", label: "Tous les jours" },
];

/** Activités proposées pour les jours sans séance — multi-select avec "Autre"
 * libre (cf. horse-health.tsx) ; affiché ensuite sur les jours de repos dans
 * Planning/Today pour que ce ne soit pas juste "rien de prévu". */
export const REST_DAY_ACTIVITIES: string[] = [
  "Paddock / pré",
  "Marche en main",
  "Longe",
  "Repos box complet",
  "Soins / pansage",
];

/** Tempérament — multi-select libre, pas de notion de force/faiblesse. */
export const HORSE_TEMPERAMENTS: string[] = [
  "Calme",
  "Sensible",
  "Joueur",
  "Craintif",
  "Téméraire",
  "Affectueux",
  "Dominant",
  "Sociable",
  "Indépendant",
  "Méfiant",
  "Curieux",
  "Têtu",
];

/** Sentinelle d'exclusion mutuelle pour les conditions de santé. */
export const NO_HEALTH_CONDITION = "Aucun problème connu";

export const HEALTH_CONDITIONS: string[] = [
  NO_HEALTH_CONDITION,
  "Arthrose",
  "Souffle / problème respiratoire",
  "Problème de dos",
  "Fourbure",
  "Tendinite chronique",
  "Coliques récurrentes",
  "Allergies cutanées",
  "Problème de pieds / sabots",
  "Problème de vue",
];

/** Types de blessures suggérés pour l'historique — `OTHER_OPTION` réutilisé comme sentinelle "Autre". */
export const INJURY_TYPES: { value: string; label: string }[] = [
  { value: "Tendinite", label: "Tendinite" },
  { value: "Entorse", label: "Entorse" },
  { value: "Fracture", label: "Fracture" },
  { value: "Fourbure", label: "Fourbure" },
  { value: "Colique", label: "Colique" },
  { value: "Problème de dos", label: "Problème de dos" },
  { value: "Problème respiratoire", label: "Problème respiratoire" },
  { value: "Plaie / blessure superficielle", label: "Plaie / blessure superficielle" },
  { value: OTHER_OPTION, label: "Autre" },
];

export const RECOVERY_STATUSES: Option<HorseRecoveryStatus>[] = [
  { value: "RECOVERED", label: "Complètement rétabli" },
  { value: "IN_PROGRESS", label: "Récupération en cours" },
  { value: "ONGOING", label: "Séquelle à surveiller" },
];
