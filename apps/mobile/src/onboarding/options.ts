import type { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
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
} from "./store";

/** Nombre d'étapes affichant la barre de progression (welcome/building/paywall exclus). */
export const TOTAL_STEPS = 9;

/** Valeur sentinelle UI pour "option non listée" (race, type de blessure...) — jamais persistée telle quelle. */
export const OTHER_OPTION = "__OTHER__";

export type OptionIcon = { name: keyof typeof MaterialCommunityIcons.glyphMap; color: string };

/** Libellés FR affichés à l'utilisateur, indexés par la valeur d'enum (= valeur Prisma). */
export type Option<T extends string> = { value: T; label: string; icon?: OptionIcon };

export const RIDER_LEVELS: Option<RiderLevel>[] = [
  { value: "BEGINNER", label: "Débutant" },
  { value: "GALOP_1_4", label: "Galop 1 à 4" },
  { value: "GALOP_5_7", label: "Galop 5 à 7" },
  { value: "AMATEUR", label: "Amateur / Club" },
  { value: "PRO", label: "Professionnel" },
];

export const RIDE_FREQUENCIES: Option<RideFrequency>[] = [
  { value: "DAILY", label: "Tous les jours", icon: { name: "calendar-month-outline", color: colors.primary } },
  { value: "SEVERAL_PER_WEEK", label: "Plusieurs fois par semaine", icon: { name: "horse-variant", color: colors.accent } },
  { value: "WEEKEND", label: "Le week-end", icon: { name: "weather-sunny", color: colors.warning } },
  { value: "OCCASIONAL", label: "De temps en temps", icon: { name: "leaf", color: colors.success } },
];

export const DISCIPLINES: Option<Discipline>[] = [
  { value: "SHOW_JUMPING", label: "Saut d'obstacles (CSO)", icon: { name: "flag-checkered", color: colors.accent } },
  { value: "DRESSAGE", label: "Dressage", icon: { name: "target", color: colors.primary } },
  { value: "EVENTING", label: "Concours complet", icon: { name: "medal-outline", color: colors.accent } },
  { value: "WESTERN", label: "Western", icon: { name: "horseshoe", color: colors.warning } },
  { value: "ENDURANCE", label: "Endurance", icon: { name: "compass-outline", color: colors.success } },
  { value: "LEISURE", label: "Loisir / Balade", icon: { name: "pine-tree", color: colors.success } },
  { value: "ETHOLOGY", label: "Éthologie", icon: { name: "handshake-outline", color: colors.accent } },
];

export const RIDER_GOALS: Option<RiderGoal>[] = [
  { value: "COMPETE", label: "Progresser en concours", icon: { name: "trophy-outline", color: colors.accent } },
  { value: "BONDING", label: "Renforcer notre complicité", icon: { name: "heart-outline", color: colors.danger } },
  { value: "FITNESS", label: "Remettre mon cheval en forme", icon: { name: "dumbbell", color: colors.primary } },
  { value: "EVENT_PREP", label: "Préparer un événement précis", icon: { name: "calendar-check-outline", color: colors.accent } },
  { value: "CONFIDENCE", label: "Reprendre confiance", icon: { name: "star-outline", color: colors.warning } },
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
  { value: "RESTING", label: "Au repos", icon: { name: "weather-night", color: colors.textMuted } },
  { value: "REOPENING", label: "Reprise en main", icon: { name: "sprout-outline", color: colors.success } },
  { value: "GOOD", label: "Bonne forme", icon: { name: "thumb-up-outline", color: colors.primary } },
  { value: "PEAK", label: "Forme optimale / compétition", icon: { name: "fire", color: colors.warning } },
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
