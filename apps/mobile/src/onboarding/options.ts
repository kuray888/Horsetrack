import type {
  RiderLevel,
  RideFrequency,
  Discipline,
  RiderGoal,
  HorseSex,
  HorseLevel,
} from "./store";

/** Nombre d'étapes affichant la barre de progression (welcome/building/paywall exclus). */
export const TOTAL_STEPS = 7;

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
