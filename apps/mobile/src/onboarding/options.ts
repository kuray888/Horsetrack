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
import { t } from "@/i18n";

/** Nombre d'étapes affichant la barre de progression (welcome/building/paywall
 * exclus) : niveau, discipline, cheval, chevaux. Fréquence et objectif ne sont
 * plus demandés à l'inscription (ils ne personnalisaient rien, retour produit
 * du 2026-09-27) : ils restent modifiables depuis le Profil. */
export const TOTAL_STEPS = 4;

/** Valeur sentinelle UI pour "option non listée" (race, type de blessure...) — jamais persistée telle quelle. */
export const OTHER_OPTION = "__OTHER__";

export type OptionIcon = { name: keyof typeof MaterialCommunityIcons.glyphMap; color: string };

/** Libellés FR affichés à l'utilisateur, indexés par la valeur d'enum (= valeur Prisma). */
export type Option<T extends string> = { value: T; label: string; icon?: OptionIcon };

// 4 niveaux proposés à la création/modification — "Poney / Club" réintroduit
// (cf. demande du 2026-09-17, qui revient sur le retrait fait à l'audit Phase
// 8 tranche D) en réutilisant GALOP_1_4, déjà présent dans l'enum Prisma
// RiderLevel mais jusqu'ici masqué de l'UI (cf. RIDER_LEVEL_TO_HORSE_LEVEL
// plus bas, qui le fait déjà correspondre à HorseLevel.CLUB) — aucune
// migration nécessaire. GALOP_5_7 reste masqué : seule "Poney / Club" a été
// redemandée, pas les Galops détaillés. Ne pas confondre avec HorseLevel.CLUB
// (niveau du CHEVAL), qui reste un enum distinct.
export const RIDER_LEVELS: Option<RiderLevel>[] = [
  { value: "BEGINNER", label: t("Débutant") },
  { value: "AMATEUR", label: t("Amateur") },
  { value: "PRO", label: t("Professionnel") },
  { value: "GALOP_1_4", label: t("Poney / Club") },
];

export const RIDE_FREQUENCIES: Option<RideFrequency>[] = [
  { value: "DAILY", label: t("Tous les jours"), icon: { name: "calendar-month-outline", color: colors.primary } },
  { value: "SEVERAL_PER_WEEK", label: t("Plusieurs fois par semaine"), icon: { name: "horse-variant", color: colors.accent } },
  { value: "WEEKEND", label: t("Le week-end"), icon: { name: "weather-sunny", color: colors.warning } },
  { value: "OCCASIONAL", label: t("De temps en temps"), icon: { name: "leaf", color: colors.success } },
];

export const DISCIPLINES: Option<Discipline>[] = [
  { value: "SHOW_JUMPING", label: t("Saut d'obstacles (CSO)"), icon: { name: "flag-checkered", color: colors.accent } },
  { value: "HUNTER", label: t("Hunter"), icon: { name: "leaf-circle-outline", color: colors.primary } },
  { value: "DRESSAGE", label: t("Dressage"), icon: { name: "target", color: colors.primary } },
  { value: "EVENTING", label: t("Concours complet"), icon: { name: "medal-outline", color: colors.accent } },
  { value: "WESTERN", label: t("Western"), icon: { name: "horseshoe", color: colors.warning } },
  { value: "ENDURANCE", label: t("Endurance"), icon: { name: "compass-outline", color: colors.success } },
  { value: "ATTELAGE", label: t("Attelage"), icon: { name: "cart-variant", color: colors.warning } },
  { value: "LEISURE", label: t("Loisir / Balade"), icon: { name: "pine-tree", color: colors.success } },
  { value: "ETHOLOGY", label: t("Éthologie"), icon: { name: "handshake-outline", color: colors.accent } },
];

export const RIDER_GOALS: Option<RiderGoal>[] = [
  { value: "COMPETE", label: t("Progresser en concours"), icon: { name: "trophy-outline", color: colors.accent } },
  { value: "BONDING", label: t("Renforcer notre complicité"), icon: { name: "heart-outline", color: colors.danger } },
  { value: "FITNESS", label: t("Remettre mon cheval en forme"), icon: { name: "dumbbell", color: colors.primary } },
  { value: "EVENT_PREP", label: t("Préparer un événement précis"), icon: { name: "calendar-check-outline", color: colors.accent } },
  { value: "CONFIDENCE", label: t("Reprendre confiance"), icon: { name: "star-outline", color: colors.warning } },
];

export const HORSE_SEXES: Option<HorseSex>[] = [
  { value: "GELDING", label: t("Hongre") },
  { value: "MARE", label: t("Jument") },
  { value: "STALLION", label: t("Entier") },
];

export const HORSE_LEVELS: Option<HorseLevel>[] = [
  { value: "UNTRAINED", label: t("Débourré / vert") },
  { value: "CLUB", label: t("Niveau club") },
  { value: "AMATEUR", label: t("Amateur") },
  { value: "PRO", label: t("Professionnel") },
];

/** Le profil sportif du cheval (discipline/niveau) n'est plus demandé à
 * l'onboarding (cf. audit du 2026-09-05 : raccourcir le parcours, ces champs
 * ne sont utilisés que pour l'affichage, jamais pour une adaptation réelle)
 * — un cheval créé pendant l'onboarding hérite par défaut de la discipline
 * et du niveau déjà déclarés par le cavalier (cf. (onboarding)/paywall.tsx),
 * modifiables ensuite librement depuis sa fiche (Horse Hub > Modifier).
 * HorseLevel n'a pas d'équivalent exact pour chaque RiderLevel (ex. aucun
 * "Galop") : on retombe sur la valeur la plus proche plutôt que de bloquer. */
export const RIDER_LEVEL_TO_HORSE_LEVEL: Record<RiderLevel, HorseLevel> = {
  BEGINNER: "CLUB",
  GALOP_1_4: "CLUB",
  GALOP_5_7: "AMATEUR",
  AMATEUR: "AMATEUR",
  PRO: "PRO",
};

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
  { value: "Selle Français", label: t("Selle Français") },
  { value: "Pur-sang anglais", label: t("Pur-sang anglais") },
  { value: "Anglo-arabe", label: "Anglo-arabe" },
  { value: "KWPN", label: t("KWPN (Hollandais)") },
  { value: "Hanovrien", label: t("Hanovrien") },
  { value: "Lusitanien", label: t("Lusitanien") },
  { value: "Pure race espagnole", label: t("Pure race espagnole (PRE)") },
  { value: "Frison", label: t("Frison") },
  { value: "Quarter Horse", label: t("Quarter Horse") },
  { value: "Camargue", label: t("Camargue") },
  { value: "Comtois", label: t("Comtois") },
  { value: "Trait", label: t("Cheval de trait") },
  { value: "Connemara", label: t("Connemara") },
  { value: "Welsh", label: t("Welsh") },
  { value: "Shetland", label: t("Shetland") },
  { value: "Arabe", label: t("Pur-sang arabe") },
  { value: OTHER_OPTION, label: t("Autre / je ne sais pas") },
];

/** Robes courantes proposées en dropdown — `OTHER_OPTION` ouvre un champ libre,
 * même pattern que HORSE_BREEDS ci-dessus (cf. CoatField). */
export const HORSE_COATS: { value: string; label: string }[] = [
  { value: "Bai", label: t("Bai") },
  { value: "Alezan", label: t("Alezan") },
  { value: "Noir", label: t("Noir") },
  { value: "Gris", label: t("Gris") },
  { value: "Isabelle", label: t("Isabelle") },
  { value: "Palomino", label: t("Palomino") },
  { value: "Pie", label: t("Pie") },
  { value: "Rouan", label: t("Rouan") },
  { value: "Aubère", label: t("Aubère") },
  { value: "Louvet", label: t("Louvet") },
  { value: OTHER_OPTION, label: t("Autre / je ne sais pas") },
];

export const HORSE_FITNESS_LEVELS: Option<HorseFitnessLevel>[] = [
  { value: "RESTING", label: t("Au repos"), icon: { name: "weather-night", color: colors.textMuted } },
  { value: "REOPENING", label: t("Reprise en main"), icon: { name: "sprout-outline", color: colors.success } },
  { value: "GOOD", label: t("Bonne forme"), icon: { name: "thumb-up-outline", color: colors.primary } },
  { value: "PEAK", label: t("Forme optimale / compétition"), icon: { name: "fire", color: colors.warning } },
];

export const HORSE_WORKLOADS: Option<HorseWorkload>[] = [
  { value: "NONE", label: t("Aucun travail actuellement") },
  { value: "ONE_TO_TWO", label: t("1-2 jours / semaine") },
  { value: "THREE_TO_FOUR", label: t("3-4 jours / semaine") },
  { value: "FIVE_TO_SIX", label: t("5-6 jours / semaine") },
  { value: "DAILY", label: t("Tous les jours") },
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
  { value: "Tendinite", label: t("Tendinite") },
  { value: "Entorse", label: t("Entorse") },
  { value: "Fracture", label: t("Fracture") },
  { value: "Fourbure", label: t("Fourbure") },
  { value: "Colique", label: t("Colique") },
  { value: "Problème de dos", label: t("Problème de dos") },
  { value: "Problème respiratoire", label: t("Problème respiratoire") },
  { value: "Plaie / blessure superficielle", label: t("Plaie / blessure superficielle") },
  { value: OTHER_OPTION, label: t("Autre") },
];

export const RECOVERY_STATUSES: Option<HorseRecoveryStatus>[] = [
  { value: "RECOVERED", label: t("Complètement rétabli") },
  { value: "IN_PROGRESS", label: t("Récupération en cours") },
  { value: "ONGOING", label: t("Séquelle à surveiller") },
];
