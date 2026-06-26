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

/** 3 variantes par type pour qu'une même séance ne soit pas identique à
 * chaque occurrence dans le programme — la rotation se fait sur le nombre de
 * fois où CE type a déjà été programmé (cf. `buildExercises`), pas sur le
 * numéro de semaine brut, donc même un cheval qui voit le même type revenir
 * souvent ne retombe sur la même variante qu'après les 3 avoir vues. Chaque
 * exercice porte une description (comment le faire / à quoi veiller) et une
 * phase d'affichage. */
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
          title: "8 min pas (dont 3 rênes longues) + 7 min trot, 2 mains",
          description: "8 min de pas dont 3 en **rênes longues** pour décontracter, puis 7 min de **trot enlevé** en changeant de main toutes les 2 **voltes**.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "10 transitions trot-galop-trot, lignes de 20 m",
          description: "Réalise 10 **transitions** nettes trot → galop → trot, en changeant de main après chaque série de 2, sur des lignes droites de 20 m minimum. Choisis l'endroit précis avant de partir, plutôt que de transitionner au hasard.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "3 voltes de 15 m par main, recherche d'incurvation",
          description: "Trace 3 **voltes** de 15 m de diamètre par main au trot, jambe intérieure au contact, en cherchant une **incurvation** homogène du garrot à la queue. Marque une pause au pas entre chaque série.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "5 min pas, rênes longues",
          description: "Termine par 5 min de pas en **rênes longues**, pour faire redescendre la fréquence cardiaque et étirer le dos du cheval.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "8 min pas/trot avec 6 changements de direction",
          description: "8 min au pas puis au trot avec 6 changements de direction, pour réveiller l'attention avant le travail précis.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "8 transitions descendantes galop-trot-pas",
          description: "Répète 8 **transitions descendantes** (galop → trot, puis trot → pas), en cherchant à conserver l'équilibre et la **rectitude** à chaque fois. Repère mentalement celles où le cheval s'est précipité, pour les retravailler la prochaine fois.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Serpentine à 4 boucles au trot, cadence stable",
          description: "Trace une **serpentine** de 4 boucles sur la longueur de la carrière au trot, en gardant une **cadence** régulière, pour travailler la souplesse latérale et l'écoute aux aides de direction.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "5 min étirements encolure basse",
          description: "Termine par 5 min au pas en recherchant l'**encolure basse**, pour relâcher le dos après le travail technique.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "10 min pas actif puis trot en lignes droites",
          description: "10 min de pas actif (le cheval marche franchement vers l'avant) puis trot en lignes droites sur toute la longueur de la carrière, pour installer l'impulsion avant le travail sur les courbes.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Spirale resserrée puis élargie × 4 par main",
          description: "Trace une **volte** de 20 m que tu resserres progressivement jusqu'à 10 m puis élargis à nouveau, 4 fois par main, pour développer la **rectitude** et l'**incurvation** sans perdre l'allure.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Variations de cadence au trot sur le grand côté",
          description: "Sur chaque grand côté, demande 3-4 foulées plus amples puis un retour à la **cadence** normale, pour développer l'écoute aux aides sans changer d'allure.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "5 min pas en extérieur du cadre, longues rênes",
          description: "Termine par 5 min de pas en longues rênes, en sortant si possible du cadre habituel de travail (changement de terrain), pour décompresser mentalement autant que physiquement.",
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
          title: "3 min étirements à pied + 8 min pas/trot en selle",
          description: "3 min d'étirements doux en main avant de monter, puis 8 min au pas et au trot en selle pour mettre le cheval en mouvement progressivement.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Épaule en dedans, 3 répétitions de 10 m par main",
          description: "Demande une **épaule en dedans** au pas sur 3 répétitions de 10 m par main, avec une pause au pas normal entre chaque pour vérifier la détente avant de répéter.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Appuyers au trot, 4 traversées de la carrière",
          description: "Travaille 4 traversées en **appuyer** au trot (2 par main) sur la largeur de la carrière, pour développer la dissociation avant/arrière et la décontraction.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "Reculer 3×5 pas + 30 sec d'immobilité",
          description: "Termine par 3 séries de 5 pas de reculer calme, suivies de 30 secondes d'immobilité totale à chaque fois, pour renforcer l'écoute et la patience.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "10 min courbes variées (cercles 20 m puis voltes 10 m)",
          description: "10 min au pas puis au trot en alternant grands cercles et **voltes** plus serrées, pour assouplir progressivement avant le travail latéral.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Cession à la jambe, pas puis trot, 2 longueurs par main",
          description: "Travaille la **cession à la jambe** sur 2 longueurs de carrière par main, d'abord au pas puis au trot une fois la réponse nette, pour affiner la réactivité aux aides latérales.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Alternance trot rassemblé/trot moyen × 6",
          description: "Alterne 6 fois quelques mètres de **trot rassemblé** et quelques mètres de **trot moyen** sur la même ligne, pour développer l'élasticité du dos.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "5 min pas allongé, rênes longues",
          description: "Termine par 5 min de **pas allongé**, en **rênes longues**, pour détendre complètement le cheval après le travail technique.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "8 min pas avec flexions latérales légères",
          description: "8 min au pas en demandant de courtes flexions latérales de l'encolure, à l'arrêt puis en mouvement, pour réveiller la décontraction de la mâchoire avant le travail.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Huit de chiffre au trot, 2 voltes de 15 m reliées",
          description: "Trace un **huit de chiffre** formé de 2 **voltes** de 15 m reliées par une diagonale, au trot, en changeant de pli au croisement, pour travailler la souplesse dans les deux sens sans interruption.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Transitions trot-pas-trot sur la volte × 6",
          description: "Réalise 6 **transitions** trot-pas-trot exactement sur le tracé d'une **volte** de 15 m, pour combiner le travail de souplesse latérale et la précision des transitions.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "5 min pas, flexions latérales à l'arrêt",
          description: "Termine à l'arrêt par quelques flexions latérales douces de chaque côté, pour finir sur une décontraction complète de la mâchoire et de l'encolure.",
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
          title: "Barre isolée × 6 passages (3 pas + 3 trot)",
          description: "3 passages au pas puis 3 au trot sur une barre isolée, pour réveiller la précision des postérieurs avant l'exercice principal.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Ligne de 4 barres, distances variées × 5 passages",
          description: "Enchaîne 5 passages sur une ligne de 4 barres aux distances variées (cf. repères techniques), en alternant les mains, pour travailler la régularité de la **foulée**.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "5 min de trot sans étriers",
          description: "Reprends 5 min de **trot enlevé** sans étriers sur le plat, pour renforcer ton **assiette** et ta stabilité indépendamment du cheval.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "5 min pas, étirements",
          description: "Termine au pas en laissant le cheval s'étirer **encolure basse**, en valorisant le travail accompli.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "Barres en éventail × 4 passages",
          description: "4 passages sur des barres disposées en éventail, en variant l'entrée, pour travailler la précision sur des distances qui se resserrent ou s'élargissent.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Ligne de barres au trot, 6 passages cadence stable",
          description: "Maintiens une **cadence** de trot strictement identique sur 6 passages d'une même ligne de barres, pour développer la régularité et l'équilibre du cheval.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Cavalettis bas × 5 passages",
          description: "Enchaîne 5 passages sur une ligne de **cavalettis** bas (5-10 cm) au trot, pour développer la technique des membres sans la contrainte du saut.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "5 min pas, rênes longues",
          description: "Reviens au pas, **rênes longues**, et laisse le cheval s'étirer **encolure basse** pour décontracter le dos.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "Barre unique abordée des deux mains × 6",
          description: "Aborde une barre isolée 6 fois en alternant les mains, au pas puis au trot, pour vérifier que le cheval reste droit à l'approche quel que soit le sens.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Ligne de barres sur une courbe légère × 5 passages",
          description: "Dispose 3 à 4 barres sur une courbe légère (pas une ligne droite) et enchaîne 5 passages au trot, pour travailler l'équilibre et l'**incurvation** en plus de la régularité de la **foulée**.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Transitions trot-pas au-dessus d'une grille de barres",
          description: "Place 4 à 5 barres rapprochées et alterne des passages au trot puis au pas dessus, pour renforcer l'**engagement** des postérieurs sans monter en vitesse.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "5 min pas, valorisation",
          description: "Termine au pas en valorisant largement le travail de précision accompli, pour ancrer une fin de séance positive.",
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
          title: "Barre au sol puis cavaletti × 6 passages",
          description: "3 passages sur barre au sol puis 3 sur un petit **cavaletti**, au trot, pour affiner la précision avant d'introduire le saut.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "3 obstacles isolés, 2 abords chacun",
          description: "Travaille 3 obstacles isolés à la hauteur du jour (cf. repères techniques), 2 **abords** chacun en variant la main, pour développer la technique de saut sans enchaînement.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Ligne de 2-3 obstacles × 4 passages",
          description: "Enchaîne une ligne de 2 à 3 obstacles bas sur 4 passages, en respectant les distances de **foulées** indiquées, pour travailler le rythme et la régularité entre les efforts.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "5 min pas, valorisation",
          description: "Termine au pas, en valorisant largement le cheval, pour redescendre progressivement l'intensité.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "10 min échauffement progressif avec transitions",
          description: "10 min au pas puis au trot avec 4 à 5 **transitions**, pour préparer le cheval mentalement et physiquement avant d'aborder le saut.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Travail de la foulée d'appel × 6 abords",
          description: "Travaille 6 **abords** d'un obstacle isolé en ajustant la **foulée d'appel** 2 à 3 mètres avant le saut, pour affiner ton sens du rythme et de la distance.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Enchaînement avec 3 changements de main",
          description: "Enchaîne plusieurs obstacles en intégrant 3 changements de main, pour travailler la maniabilité et l'anticipation.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "5 min pas calme",
          description: "Termine par un retour au pas calme, en récompensant largement le cheval pour le travail fourni.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "Cavaletti puis petit obstacle isolé × 5 passages",
          description: "5 passages au trot, d'abord sur un **cavaletti** puis sur un obstacle isolé très bas, pour installer le rythme avant d'enchaîner sur le travail principal.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Gymnastique : 2-3 obstacles rapprochés × 5 passages",
          description: "Enchaîne 2 à 3 obstacles bas rapprochés (une **foulée** entre chaque, cf. repères techniques), au trot, pour développer la technique et la rapidité de réaction des membres sans vitesse excessive.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Ligne en courbe légère × 4 passages",
          description: "Aborde une ligne de 2 obstacles disposée sur une courbe légère plutôt qu'une ligne droite, 4 passages en alternant les mains, pour travailler l'équilibre et l'anticipation du tracé.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "5 min pas, retour calme",
          description: "Termine par un retour au pas, rênes détendues, en valorisant le cheval pour le travail technique fourni.",
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
          title: "15 min marche tranquille",
          description: "15 min de marche tranquille en extérieur pour mettre le cheval en confiance et chauffer les muscles progressivement.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "20 min trot enlevé, terrain plat, diagonales alternées",
          description: "Enchaîne 20 min de **trot enlevé** sur terrain plat, en alternant les **diagonales** toutes les 2-3 minutes, pour travailler l'endurance sans solliciter excessivement le dos.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "2 galops tranquilles de ~400 m si terrain sécurisé",
          description: "Si le terrain le permet, propose 2 galops tranquilles de ~400 m sur une ligne droite dégagée et sécurisée, en laissant le temps de revenir au trot entre les deux.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "10 min pas, étirements",
          description: "Termine par 10 min au pas en laissant le cheval s'étirer, pour bien récupérer avant le retour.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "15 min marche en terrain varié",
          description: "15 min de marche sur un terrain varié (montées, descentes légères) pour solliciter en douceur différents groupes musculaires.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "20 min trot assis sur de longues lignes",
          description: "Travaille 20 min de **trot assis** sur de longues lignes droites, pour développer ton équilibre et l'endurance du cheval.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Franchissement d'1-2 obstacles naturels",
          description: "Aborde calmement 1 à 2 obstacles naturels (fossé, talus, gué) pour développer la confiance et l'aisance en extérieur.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "10 min marche calme",
          description: "Termine par 10 min de marche calme pour permettre une bonne récupération avant le retour à l'écurie.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "10 min marche en explorant un nouveau tracé",
          description: "10 min de marche en explorant si possible un tracé ou un environnement légèrement différent de d'habitude, pour stimuler l'attention du cheval dès le départ.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Alternance trot/pas par tranches de 5 min × 3",
          description: "Alterne 3 fois 5 min de **trot enlevé** et 5 min de pas actif, pour travailler l'endurance par paliers plutôt qu'en continu — plus facile à doser sur un terrain inconnu.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Passage d'1-2 éléments inhabituels du terrain",
          description: "Si l'occasion se présente, laisse le cheval observer puis franchir calmement 1 à 2 éléments inhabituels (pont, flaque, véhicule au loin), pour développer son aisance générale en extérieur.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "10 min marche, retour progressif",
          description: "Termine par 10 min de marche tranquille en revenant progressivement vers un terrain connu, pour une fin de sortie sereine.",
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
          title: "10 min pansage + observation",
          description: "10 min de pansage, en observant l'état général du cheval (**locomotion**, moral, sensibilités) avant de commencer.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Respect des distances × 8 arrêts/départs",
          description: "Travaille le respect de l'espace personnel en menant le cheval avec 8 arrêts/départs nets sur une ligne droite de 20 m.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "10 min longe ou liberté, 2 allures",
          description: "Propose 10 min de **longe** ou de liberté en demandant 2 allures distinctes (pas/trot), pour observer les allures et renforcer la communication par la voix et le corps.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "5 min détente partagée",
          description: "Termine par 5 minutes calmes, sans exigence, pour renforcer simplement la relation.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "5 min désensibilisation à 1 objet nouveau",
          description: "5 min de **désensibilisation** à un objet nouveau (bâche, plot, ballon), en laissant le cheval l'explorer à son rythme, sans le forcer au contact.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Mène en main, 6 changements de direction/allure",
          description: "Travaille 6 changements de direction et d'allure en main sur un parcours simple, pour affiner l'écoute du cheval.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Transitions à pied × 8 (arrêt/marche/reculer)",
          description: "Demande 8 **transitions** (arrêt / marche / reculer) en main, en cherchant une réponse de plus en plus rapide, pour renforcer la précision des réponses.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "5 min temps calme",
          description: "Termine par 5 minutes sans exercice, juste présence et calme partagés.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "5 min marche en main libre, observation du comportement",
          description: "5 min de marche en main, **longe** détendue, en observant l'attitude générale du cheval (oreilles, regard, façon de suivre) avant de commencer l'exercice.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Slalom entre 4 plots, mené en main × 4 passages",
          description: "Mène le cheval en main à travers un slalom de 4 plots espacés de quelques mètres, 4 passages, pour travailler la précision du placement et l'écoute fine aux indications du meneur.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Immobilité prolongée pendant une tâche annexe (2 min)",
          description: "Demande une immobilité de 2 minutes pendant que tu effectues une tâche annexe (réglage de matériel, par exemple), pour renforcer la patience sans présence active continue.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "5 min détente, retour au calme",
          description: "Termine par 5 minutes de présence calme, sans exigence, pour clore la séance sur une note détendue.",
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
          title: "10 min pas-trot progressif",
          description: "10 min au pas puis au trot, en augmentant progressivement l'amplitude avant le travail de fond.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Transitions pas-trot-pas × 12",
          description: "Multiplie 12 **transitions** pas-trot-pas réparties sur la séance, pour développer l'**engagement** des postérieurs et la tonicité générale.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "6 montées de côte douce si terrain dispo",
          description: "Si le terrain le permet, intègre 6 montées d'une pente douce au pas (voire au trot si le cheval est à l'aise), pour solliciter davantage la musculature.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "5 min étirements",
          description: "Termine par 5 minutes d'étirements au pas pour relâcher les muscles sollicités pendant la séance.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "8 montées de côte douce, pas",
          description: "8 montées d'une côte douce au pas, pour renforcer l'arrière-main en début de séance.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Reculer en ligne droite × 6 séries de 8 pas",
          description: "Travaille 6 séries de 8 pas de reculer en ligne droite, pour développer la force et la coordination de l'arrière-main.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Cercles resserrés de 10 m × 4 par main",
          description: "Propose 4 cercles resserrés de 10 m de diamètre par main, au pas puis au trot, pour solliciter l'**engagement** et l'équilibre latéral.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "5 min pas détendu",
          description: "Termine par un pas détendu de 5 minutes pour permettre une bonne récupération musculaire.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "10 min pas-trot avec changements de direction réguliers",
          description: "10 min au pas puis au trot avec un changement de direction toutes les 2-3 min, pour solliciter les deux côtés du corps dès l'échauffement.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Allongements/raccourcissements de foulée au trot × 8",
          description: "Sur la longueur de la carrière, demande 8 allers-retours d'allongement puis raccourcissement de la **foulée** au trot, pour développer la poussée des postérieurs et la tonicité du dos.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Serpentine à 3 boucles, jambe intérieure active",
          description: "Trace une **serpentine** de 3 boucles en demandant un engagement actif de la jambe intérieure à chaque changement de courbe, pour renforcer la musculature latérale.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "5 min pas, étirements encolure",
          description: "Termine par 5 minutes au pas en laissant le cheval étirer son encolure, pour relâcher les muscles sollicités.",
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
          title: "10 min marche en main",
          description: "10 min de marche en main, sans monter, pour favoriser une circulation douce sans charge.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Étirements doux de l'encolure, si à l'aise",
          description: "Propose quelques étirements doux de l'encolure (haut/bas, latéraux) si le cheval se montre à l'aise, sans jamais forcer.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "5 min d'observation de la locomotion",
          description: "Observe attentivement 5 min la **locomotion** du cheval au pas, pour repérer toute gêne ou amélioration.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "Pas de travail monté tant que la forme n'est pas meilleure",
          description: "Laisse le travail monté de côté jusqu'à ce que la forme du cheval le permette à nouveau — la prudence prime sur le programme.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "15 min pansage complet",
          description: "15 min de pansage complet et minutieux, bon moment de contact sans aucune exigence physique.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "10 min liberté au paddock",
          description: "10 min de liberté au paddock, pour un mouvement naturel et non contraint.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "5 min d'observation du comportement",
          description: "Observe 5 minutes le comportement général (appétit, moral, façon de se déplacer) pour suivre l'évolution de sa forme.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "Bilan vétérinaire/ostéopathe si besoin",
          description: "Si un doute persiste sur la récupération, prévois un point avec le vétérinaire ou l'**ostéopathe** avant de reprendre le travail.",
        },
      ],
      [
        {
          phase: "ECHAUFFEMENT",
          title: "10 min de soins (douche, pansage léger selon météo)",
          description: "10 min de soins doux (douche fraîche si la météo s'y prête, sinon pansage léger), sans aucune sollicitation physique, juste pour le confort du cheval.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "5 min de marche très calme en main, si à l'aise",
          description: "Si le cheval se montre à l'aise, propose 5 minutes de marche très calme en main sur terrain plat, sinon laisse-le simplement au repos complet.",
        },
        {
          phase: "CORPS_DE_SEANCE",
          title: "Observation de l'appétit et du comportement au box/pré",
          description: "Observe l'appétit et le comportement général au box ou au pré dans les heures qui suivent, pour détecter tout signe inhabituel à signaler.",
        },
        {
          phase: "RETOUR_AU_CALME",
          title: "Pas de sollicitation supplémentaire",
          description: "Ne rajoute aucune sollicitation supplémentaire ce jour-là — la récupération prime sur toute idée de progression.",
        },
      ],
    ],
  },
};

/** Exercice "bonus" tenant compte explicitement de l'objectif déclaré par le
 * cavalier à l'onboarding — injecté en complément du contenu de base (cf.
 * buildExercises), pour qu'un objectif comme "préparer une échéance" ou
 * "renforcer la complicité" se traduise en un vrai exercice concret plutôt
 * que de rester un simple thème affiché en haut de l'écran Planning. */
const GOAL_EXERCISE: Record<RiderGoal, ExerciseStepDraft> = {
  COMPETE: {
    phase: "CORPS_DE_SEANCE",
    title: "Simulation d'épreuve, un seul passage",
    description: "Réalise l'exercice du jour en conditions d'épreuve : un seul passage, sans répéter même en cas d'erreur, comme face à un jury. Note ensuite à chaud ce qui a fonctionné et ce qui demande encore du travail.",
  },
  BONDING: {
    phase: "RETOUR_AU_CALME",
    title: "5 min de complicité sans exigence",
    description: "Termine par 5 minutes sans aucun objectif technique : caresses, voix, simple présence côte à côte. Le seul but est de renforcer le lien, hors de toute notion de performance.",
  },
  FITNESS: {
    phase: "CORPS_DE_SEANCE",
    title: "Bloc cardio supplémentaire : 6 min de trot soutenu",
    description: "Ajoute 6 minutes de **trot enlevé** soutenu (ou un galop tranquille si le terrain le permet) en plus du travail prévu, pour développer le fond physique. Arrête immédiatement en cas d'essoufflement marqué ou d'inconfort.",
  },
  EVENT_PREP: {
    phase: "CORPS_DE_SEANCE",
    title: "Répétition dans les conditions réelles",
    description: "Reproduis autant que possible les conditions de l'échéance à venir (matériel, horaire, terrain) pour habituer le cheval aux conditions exactes du jour J.",
  },
  CONFIDENCE: {
    phase: "RETOUR_AU_CALME",
    title: "Finir sur un exercice déjà maîtrisé",
    description: "Termine la séance sur un exercice simple, déjà réussi récemment, pour clore sur une réussite nette et renforcer la confiance avant de redescendre de cheval.",
  },
};

/** Matériel typiquement nécessaire selon le type de séance — déduit
 * automatiquement, affiché au cavalier pour préparer la séance en amont. */
const SESSION_EQUIPMENT: Record<SessionType, string[]> = {
  DRESSAGE_BASICS: ["Aucun matériel particulier"],
  ASSOUPLISSEMENT: ["Aucun matériel particulier"],
  BARRES_AU_SOL: ["4 à 6 barres au sol", "Plots ou soucoupes pour matérialiser les distances"],
  OBSTACLE: ["Barres au sol", "2 à 3 obstacles bas (**cavalettis** ou **croisillons**)", "Plots de matérialisation"],
  SORTIE_EXTERIEURE: ["Protections de travail (**guêtres** ou **protège-boulets**)", "Tenue adaptée à la météo"],
  TRAVAIL_A_PIED: ["Licol et **longe** (ou **caveçon**)", "Stick ou **chambrière** si besoin", "Objet de **désensibilisation** selon l'exercice du jour"],
  RENFORCEMENT: ["Aucun matériel obligatoire", "Terrain varié en option (côte, sol meuble)"],
  RECUPERATION: ["Aucun matériel — privilégier le confort du cheval"],
};

/** Cheval de référence (≈ selle français/anglo-arabe moyen) sur lequel sont
 * calibrés les écartements ci-dessous — mis à l'échelle de la taille déclarée
 * du cheval (s'il y en a une) plutôt que figés : un poney et un grand cheval
 * n'ont pas la même amplitude de foulée. */
const REFERENCE_HEIGHT_CM = 160;

/** Écartement de barres au sol par allure, pour un cheval à hauteur de
 * référence — repères couramment enseignés (FFE/BPJEPS), pas une norme
 * absolue : la foulée réelle varie aussi avec l'équilibre et la décontraction
 * du cheval, pas seulement sa taille. */
const POLE_SPACING_BASE_CM: Record<"pas" | "trot" | "galop", number> = {
  pas: 85,
  trot: 135,
  galop: 330,
};

function poleSpacingCm(gait: "pas" | "trot" | "galop", horse: Horse): number {
  const scale = (horse.heightCm ?? REFERENCE_HEIGHT_CM) / REFERENCE_HEIGHT_CM;
  return Math.round((POLE_SPACING_BASE_CM[gait] * scale) / 5) * 5;
}

/** Distance entre deux obstacles d'une ligne, pour un cheval à hauteur de
 * référence : une foulée de galop (~3,50 m) par foulée demandée, plus un
 * forfait d'appel + réception (~3,50 m) — repère classique pour une ligne
 * "normale", à ajuster selon le profil de saut réel du cheval. */
const CANTER_STRIDE_CM = 350;
const LANDING_TAKEOFF_ALLOWANCE_CM = 350;

function lineDistanceCm(strides: number, horse: Horse): number {
  const scale = (horse.heightCm ?? REFERENCE_HEIGHT_CM) / REFERENCE_HEIGHT_CM;
  return Math.round(((strides * CANTER_STRIDE_CM + LANDING_TAKEOFF_ALLOWANCE_CM) * scale) / 10) * 10;
}

/** Hauteur de saut indicative par niveau du cheval — point de départ
 * raisonnable, pas une norme de concours (qui dépend du circuit réel, hors de
 * ce que l'app connaît) : à ajuster au ressenti, idéalement avec un
 * instructeur présent plutôt que suivi à la lettre. */
const JUMP_HEIGHT_RANGE_CM: Record<HorseLevel, [number, number]> = {
  UNTRAINED: [20, 40],
  CLUB: [40, 60],
  AMATEUR: [70, 90],
  PRO: [100, 120],
};

function jumpHeightCm(horse: Horse, intensity: SessionIntensity): number {
  const [low, high] = JUMP_HEIGHT_RANGE_CM[horse.level];
  if (intensity === "LOW") return low;
  if (intensity === "HIGH") return high;
  return Math.round((low + high) / 2 / 5) * 5;
}

/** Nombre total d'efforts de saut (lignes comprises) jugé raisonnable sur UNE
 * séance, par niveau et intensité — au-delà, le risque de surmenage articulaire
 * dépasse le bénéfice technique, quel que soit le niveau du cheval. Repère de
 * bien-être courant, pas une règle gravée dans le marbre. */
const JUMP_COUNT_RANGE: Record<HorseLevel, [number, number]> = {
  UNTRAINED: [8, 12],
  CLUB: [12, 18],
  AMATEUR: [15, 20],
  PRO: [18, 25],
};

function jumpCount(horse: Horse, intensity: SessionIntensity): number {
  const [low, high] = JUMP_COUNT_RANGE[horse.level];
  if (intensity === "LOW") return low;
  if (intensity === "HIGH") return high;
  return Math.round((low + high) / 2);
}

/** Catégorie usuelle (poney/cheval, seuil légal FFE à 1,48 m au garrot) — sert
 * surtout à formuler l'hypothèse de taille en clair plutôt qu'en centimètres
 * abstraits quand la taille réelle du cheval n'est pas connue. */
function horseSizeCategory(heightCm: number): string {
  if (heightCm < 120) return "petit poney";
  if (heightCm < 148) return "poney";
  if (heightCm < 175) return "cheval";
  return "grand cheval";
}

/** Rend explicite l'hypothèse de taille utilisée pour les écartements/hauteurs
 * ci-dessus — un repère silencieux serait trompeur si la taille réelle (poney
 * vs grand cheval) change beaucoup la pertinence du chiffre affiché. */
function heightAssumptionNote(horse: Horse): string {
  if (horse.heightCm) {
    return `Repères ajustés à la taille de ${horse.name} (~${horse.heightCm} cm, ${horseSizeCategory(horse.heightCm)}).`;
  }
  return `Taille de ${horse.name} non renseignée : repères calculés pour un ${horseSizeCategory(REFERENCE_HEIGHT_CM)} standard (~${REFERENCE_HEIGHT_CM} cm) — renseigne sa taille au garrot dans sa fiche pour des repères ajustés à sa morphologie.`;
}

/** Nombre de transitions/changements d'allure visé sur la séance, proportionnel
 * à sa durée — un repère de densité de travail plutôt qu'un compte à respecter
 * à l'exercice près. */
function transitionCount(durationMin: number): number {
  return Math.max(6, Math.round(durationMin / 4));
}

/** Répartition longe / travail en main sur la durée de la séance — pour
 * donner un repère concret plutôt qu'un simple "un peu des deux". */
function inHandSplitMin(durationMin: number): { longe: number; main: number } {
  const longe = Math.round((durationMin * 0.5) / 5) * 5;
  return { longe, main: durationMin - longe };
}

/** Nombre de répétitions de côte visé, par intensité de la semaine. */
const HILL_REPS_RANGE: Record<SessionIntensity, [number, number]> = {
  LOW: [3, 4],
  MEDIUM: [5, 6],
  HIGH: [7, 8],
};

/** Part de la sortie consacrée au trot enlevé — le reste se répartit entre
 * l'échauffement/retour au pas et un éventuel temps de galop. */
function trotShareMin(durationMin: number): number {
  return Math.round((durationMin * 0.4) / 5) * 5;
}

/** Repères techniques chiffrés selon le type de séance — un complément
 * concret aux descriptions d'exercice (cf. SESSION_META), pas une
 * prescription stricte : la hauteur/l'écartement réels se règlent au ressenti
 * du jour, ce ne sont que des points de départ raisonnables. Vide pour les
 * types où chiffrer n'apporte rien (récupération, repos actif). */
function buildSetupNotes(
  type: SessionType,
  horse: Horse,
  intensity: SessionIntensity,
  durationMin: number
): string[] {
  switch (type) {
    case "BARRES_AU_SOL":
      return [
        heightAssumptionNote(horse),
        `Écartement au pas : ~${poleSpacingCm("pas", horse)} cm`,
        `Écartement au trot : ~${poleSpacingCm("trot", horse)} cm`,
        `Écartement au galop (barres de réglage) : ~${poleSpacingCm("galop", horse)} cm`,
      ];
    case "OBSTACLE":
      return [
        heightAssumptionNote(horse),
        `Hauteur indicative : ~${jumpHeightCm(horse, intensity)} cm (repère de départ, à ajuster au ressenti)`,
        `Distance de ligne à 1 **foulée** : ~${lineDistanceCm(1, horse)} cm`,
        `Distance de ligne à 2 **foulées** : ~${lineDistanceCm(2, horse)} cm`,
        `Volume total d'efforts de saut sur la séance : ~${jumpCount(horse, intensity)} (lignes comprises)`,
      ];
    case "DRESSAGE_BASICS":
    case "ASSOUPLISSEMENT":
      return [
        "Repère : **voltes**/cercles de 15 à 20 m de diamètre",
        `Repère : ~${transitionCount(durationMin)} **transitions**/changements d'allure répartis sur la séance`,
      ];
    case "TRAVAIL_A_PIED": {
      const { longe, main } = inHandSplitMin(durationMin);
      return [
        "Repère : cercle de **longe** de 15 à 20 m de diamètre si travail en longe",
        `Répartition indicative : ~${longe} min de longe/liberté, ~${main} min d'exercices en main`,
      ];
    }
    case "RENFORCEMENT": {
      const [low, high] = HILL_REPS_RANGE[intensity];
      return [
        "Repère : pente légère (5-8 %) sur 100 à 150 m si le terrain s'y prête",
        `Repère : ${low} à ${high} montées si travail en côte`,
      ];
    }
    case "SORTIE_EXTERIEURE":
      return [`Repère : ~${trotShareMin(durationMin)} min de **trot enlevé** cumulées sur la sortie, au confort du cheval`];
    case "RECUPERATION":
      return [];
    default:
      return [];
  }
}

/** Restrictions spécifiques par condition de santé déclarée — seules les
 * conditions ayant un impact connu sur l'effort/l'impact articulaire ont une
 * règle ; les autres (allergies, coliques...) restent un point de vigilance
 * sans restriction d'exercice (cf. buildPersonalizationNotes). */
const HEALTH_CONDITION_RULES: Record<string, { excludeTypes: SessionType[]; maxIntensity?: SessionIntensity; note: string }> = {
  Arthrose: {
    excludeTypes: ["OBSTACLE"],
    maxIntensity: "MEDIUM",
    note: "**Arthrose** signalée : travail de saut écarté, échauffement plus long recommandé.",
  },
  Fourbure: {
    excludeTypes: ["OBSTACLE", "BARRES_AU_SOL"],
    maxIntensity: "MEDIUM",
    note: "**Fourbure** signalée : travail à fort impact écarté, terrain souple à privilégier.",
  },
  "Tendinite chronique": {
    excludeTypes: ["OBSTACLE"],
    maxIntensity: "MEDIUM",
    note: "**Tendinite** chronique signalée : travail de saut écarté par précaution.",
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

/** Une semaine sur 3 au sein de la phase DEVELOPPEMENT (le gros du programme,
 * souvent 4-5 semaines plates sinon) est légèrement allégée plutôt que de
 * rester strictement identique d'une semaine à l'autre — principe de
 * périodisation courant (charge, charge, assimilation) qui évite la
 * stagnation ET la sensation de "toujours la même chose", en plus de la
 * rotation des exercices ci-dessus. Sans lien avec REPRISE/AFFIRMATION, qui
 * gardent leur logique propre. */
function isAssimilationWeek(weekNumber: number, phase: ProgramPhase): boolean {
  return phase === "DEVELOPPEMENT" && weekNumber % 3 === 0;
}

function intensityForPhase(base: SessionIntensity, phase: ProgramPhase, weekNumber: number): SessionIntensity {
  const idx = INTENSITY_ORDER.indexOf(base);
  if (phase === "REPRISE") return INTENSITY_ORDER[Math.max(0, idx - 1)];
  if (phase === "AFFIRMATION") return INTENSITY_ORDER[Math.min(INTENSITY_ORDER.length - 1, idx + 1)];
  if (isAssimilationWeek(weekNumber, phase)) return INTENSITY_ORDER[Math.max(0, idx - 1)];
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

/** Contenu d'un type de séance donné, prêt à substituer à une séance déjà
 * générée — réutilisé pour les ajustements dynamiques (cf. program/store.tsx :
 * repos auto après un rendez-vous vétérinaire ou un concours, bascule en plat
 * léger la veille d'un concours), en plus de l'usage normal de RECUPERATION
 * dans le pool de séances santé/blessures (cf. applyHealthAndInjuryRestrictions).
 * Même contenu, même rotation par semaine (`weekIndex`) que `generateProgram`
 * — pas une variante ad hoc. */
export function lightSessionOverride(
  type: SessionType,
  weekIndex: number,
  horse: Horse
): { title: string; focus: string; durationMin: number; equipment: string[]; exercises: ExerciseStep[] } {
  const meta = SESSION_META[type];
  return {
    title: meta.title,
    focus: meta.focus,
    durationMin: meta.baseDurationMin,
    equipment: SESSION_EQUIPMENT[type],
    exercises: buildExercises(type, weekIndex, horse, null, meta.baseDurationMin),
  };
}

export function recuperationSession(
  weekIndex: number,
  horse: Horse
): { title: string; focus: string; durationMin: number; equipment: string[]; exercises: ExerciseStep[] } {
  return lightSessionOverride("RECUPERATION", weekIndex, horse);
}

/** Types jugés trop sollicitants/techniques pour la veille d'un concours —
 * mieux vaut une séance de plat léger ce jour-là qu'un maintien du travail
 * habituel juste un peu moins intense (cf. program/store.tsx, ajustement
 * "concours demain"). Le saut et le renforcement sont les plus exposés au
 * risque de fatigue/blessure de dernière minute ; le travail de plat reste
 * sans risque particulier, juste fait plus doucement (cf. ailleurs dans
 * l'ajustement, qui se contente alors d'alléger l'intensité). */
export const PRE_COMPETITION_RISK_TYPES = new Set<SessionType>(["OBSTACLE", "BARRES_AU_SOL", "RENFORCEMENT"]);

/** Poids de charge relatif d'un type de séance (0 = aucune charge, 3 = la
 * plus intense) — même table que celle utilisée pour ordonner les séances de
 * la semaine (cf. buildDayTypes), réexposée pour le calcul du score de charge
 * réel (cf. stats/compute.ts). */
export function sessionLoad(type: SessionType): number {
  return SESSION_LOAD[type];
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

/**
 * Ordre chronologique pédagogique au sein d'une semaine, PAR DISCIPLINE —
 * distinct de SESSION_LOAD ci-dessus (qui reste une échelle universelle pour
 * le score de charge réel, cf. stats/compute.ts) : ce qui constitue le pic
 * technique de la semaine diffère selon la discipline (l'obstacle pour le
 * CSO, la sortie pour l'endurance, le plat pour le dressage...), donc un
 * classement de charge unique pour toutes les disciplines ne peut pas
 * produire un déroulé cohérent pour chacune. Principe commun appliqué à
 * chaque discipline : travail de base/assouplissement → travail préparatoire
 * plus technique → pic technique/spécialité → sortie ou récupération en fin
 * de semaine (jamais le pic d'effort en tout premier jour).
 *
 * Exemple CSO : dressage (bases) → barres au sol (préparation technique sans
 * le choc du saut) → obstacle (pic technique) → sortie extérieure (sortie/
 * récupération active).
 */
const DISCIPLINE_SESSION_ORDER: Record<Discipline, SessionType[]> = {
  SHOW_JUMPING: ["DRESSAGE_BASICS", "BARRES_AU_SOL", "OBSTACLE", "SORTIE_EXTERIEURE"],
  DRESSAGE: ["ASSOUPLISSEMENT", "DRESSAGE_BASICS", "TRAVAIL_A_PIED", "SORTIE_EXTERIEURE"],
  EVENTING: ["DRESSAGE_BASICS", "RENFORCEMENT", "OBSTACLE", "SORTIE_EXTERIEURE"],
  WESTERN: ["ASSOUPLISSEMENT", "DRESSAGE_BASICS", "TRAVAIL_A_PIED", "SORTIE_EXTERIEURE"],
  // Ici, la sortie EST le cœur de la discipline (pas une simple récupération
  // en fin de semaine comme pour les autres) — elle reste en dernier, mais
  // comme l'aboutissement de la semaine, pas comme un délestage.
  ENDURANCE: ["ASSOUPLISSEMENT", "RENFORCEMENT", "TRAVAIL_A_PIED", "SORTIE_EXTERIEURE"],
  LEISURE: ["ASSOUPLISSEMENT", "TRAVAIL_A_PIED", "SORTIE_EXTERIEURE"],
  ETHOLOGY: ["ASSOUPLISSEMENT", "TRAVAIL_A_PIED", "SORTIE_EXTERIEURE"],
};

/** Position chronologique d'un type pour la discipline donnée — celle de
 * DISCIPLINE_SESSION_ORDER si elle le liste, sinon replié en fin de semaine
 * (au-delà de tous les types explicitement ordonnés), départagé par
 * SESSION_LOAD. Le repli sert aux cas rares où un type n'appartient pas au
 * pool normal de la discipline mais y a été injecté par un biais d'objectif
 * (ex. RENFORCEMENT pour l'objectif FITNESS en dressage, cf. applyGoalBias)
 * ou par la restriction santé sévère (RECUPERATION, cf.
 * applyHealthAndInjuryRestrictions). */
function sessionOrderIndex(type: SessionType, discipline: Discipline): number {
  const order = DISCIPLINE_SESSION_ORDER[discipline] ?? DISCIPLINE_SESSION_ORDER.LEISURE;
  const idx = order.indexOf(type);
  return idx >= 0 ? idx : order.length + SESSION_LOAD[type];
}

/** Associe les jours retenus à des types de séance : la sélection (quels
 * types, combien de fois chacun) reste pilotée par le pool de discipline +
 * biais d'objectif (cf. applyGoalBias), mais l'ordre CHRONOLOGIQUE sur la
 * semaine suit le déroulé propre à la discipline (cf. DISCIPLINE_SESSION_ORDER)
 * plutôt que l'ordre brut du pool — pour une progression cohérente. La
 * tranche du pool utilisée avance d'un cran à chaque semaine (`weekIndex`) :
 * sans ça, un cavalier qui ne monte qu'1 ou 2 fois par semaine ne verrait
 * jamais que les 1-2 premiers types du pool pendant tout le programme (ex.
 * uniquement de l'obstacle en CSO, jamais de plat) — la rotation garantit que
 * tout le pool est exploré sur la durée du programme plutôt qu'une seule
 * fois pour les 8 semaines. */
function buildDayTypes(
  days: number[],
  pool: SessionType[],
  weekIndex: number,
  discipline: Discipline
): { dayOffset: number; type: SessionType }[] {
  const selected = days.map((_, i) => pool[(i + weekIndex) % pool.length]);
  const ordered = selected
    .map((type, i) => ({ type, i }))
    .sort((a, b) => sessionOrderIndex(a.type, discipline) - sessionOrderIndex(b.type, discipline) || a.i - b.i)
    .map(({ type }) => type);
  return days.map((dayOffset, i) => ({ dayOffset, type: ordered[i] }));
}

const TECHNICAL_SESSION_TYPES: SessionType[] = [
  "DRESSAGE_BASICS",
  "OBSTACLE",
  "BARRES_AU_SOL",
  "ASSOUPLISSEMENT",
  "RENFORCEMENT",
  "SORTIE_EXTERIEURE",
];

/** Part de la durée totale de la séance allouée à chaque étape de base, par
 * position (échauffement ~20 %, 2 blocs de corps de séance ~35 %/~30 %,
 * retour au calme ~15 %) — structure standard d'une séance d'équitation,
 * appliquée uniformément plutôt que recalculée par type. */
const STEP_DURATION_SHARE = [0.2, 0.35, 0.3, 0.15];
/** Part allouée à l'exercice "bonus" (point faible du cheval ou objectif du
 * cavalier) quand il est ajouté en 5e étape — un supplément ciblé, pas un
 * bloc de séance à part entière, donc volontairement plus court. */
const BONUS_EXERCISE_SHARE = 0.15;

function withDuration(draft: ExerciseStepDraft, sessionDurationMin: number, share: number): ExerciseStep {
  return { ...draft, durationMin: Math.max(1, Math.round(sessionDurationMin * share)) };
}

/**
 * `variantIndex` est le nombre de fois où CE type de séance a déjà été
 * programmé plus tôt dans le programme (cf. `generateProgram`, compteur
 * `typeOccurrence`) — pas le numéro de semaine. Avec un pool de discipline
 * court (3-4 types), le numéro de semaine cyclerait le jour de la semaine où
 * tombe chaque type bien avant d'avoir épuisé les variantes disponibles ;
 * indexer sur l'occurrence réelle du type garantit que les 3 variantes sont
 * vues avant qu'aucune ne se répète, peu important le rythme du cavalier.
 * `recuperationSession` (substitution dynamique pour le repos auto, cf.
 * program/store.tsx) continue de passer un simple numéro de semaine — usage
 * secondaire, pas la rotation régulière du programme.
 */
function buildExercises(
  type: SessionType,
  variantIndex: number,
  horse: Horse,
  goal: RiderGoal | null,
  sessionDurationMin: number
): ExerciseStep[] {
  const meta = SESSION_META[type];
  const variant = rotate(meta.exerciseVariants, variantIndex) ?? meta.exerciseVariants[0];
  const base = variant.map((step, i) => withDuration(step, sessionDurationMin, STEP_DURATION_SHARE[i] ?? 0.25));

  if (!TECHNICAL_SESSION_TYPES.includes(type)) return base;

  // Ne cible que les points faibles pertinents pour CE type de séance (cf.
  // WEAKNESS_RELEVANT_TYPES) — un tag transversal (absent de cette table)
  // reste pertinent partout.
  const relevantWeaknesses = horse.weaknesses.filter((w) => {
    const relevantTypes = WEAKNESS_RELEVANT_TYPES[w];
    return !relevantTypes || relevantTypes.includes(type);
  });
  const weakness = rotate(relevantWeaknesses, variantIndex);
  const weaknessDraft: ExerciseStepDraft | null = weakness
    ? {
        phase: "CORPS_DE_SEANCE",
        title: `Travail ciblé : ${weakness.toLowerCase()}`,
        description: `Accorde une attention particulière à ce point faible signalé pendant la séance, sans le forcer.`,
      }
    : null;
  const goalDraft = goal ? GOAL_EXERCISE[goal] : null;

  // Si les deux s'appliquent, alterne d'une occurrence à l'autre plutôt que
  // d'empiler systématiquement les deux — une séance reste lisible avec un
  // seul exercice "bonus" à la fois.
  const bonus =
    weaknessDraft && goalDraft ? (variantIndex % 2 === 0 ? weaknessDraft : goalDraft) : weaknessDraft ?? goalDraft;

  if (!bonus) return base;
  return [...base, withDuration(bonus, sessionDurationMin, BONUS_EXERCISE_SHARE)];
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
      "Jument : des variations de comportement liées aux **chaleurs** sont normales certaines semaines — adapte la patience plutôt que l'intensité."
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

/** La longe sollicite davantage les tendons/articulations qu'une marche en
 * main ou du temps au paddock (cercles serrés, contrairement à une ligne
 * droite) — ce n'est pas un vrai "repos" actif pour un cheval au repos forcé
 * ou en convalescence, même si elle est choisie comme activité de jour sans
 * séance. */
function buildRestDayNotes(horse: Horse): string[] {
  const isRestingOrRecovering =
    horse.fitnessLevel === "RESTING" || horse.injuries.some((i) => i.recoveryStatus === "IN_PROGRESS");
  if (!isRestingOrRecovering || !horse.restDayActivities.includes("Longe")) return [];
  return [
    `${horse.name} est au repos/en convalescence : la longe (cercles serrés) sollicite plus les articulations qu'une marche en main ou du paddock — à réserver à un avis vétérinaire favorable.`,
  ];
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
  safetyNotes.push(...buildRestDayNotes(horse));

  const days = spreadDays(sessionsPerWeek, rider.rideFrequency === "WEEKEND" ? WEEKEND_DAYS : undefined);

  // Compte, type par type, combien de fois chacun a déjà été programmé plus
  // tôt dans le programme (en ordre chronologique semaine puis jour) — sert
  // de base à la rotation des variantes d'exercices (cf. buildExercises),
  // plutôt que le numéro de semaine brut.
  const typeOccurrence = new Map<SessionType, number>();

  const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => {
    const weekNumber = i + 1;
    const phase = phaseForWeek(weekNumber, TOTAL_WEEKS, rider.primaryGoal);
    const weekIntensity = intensityForPhase(cappedBaseIntensity, phase, weekNumber);
    const dayTypes = buildDayTypes(days, safePool, weekNumber - 1, horse.discipline);

    const sessions: SessionTemplate[] = dayTypes.map(({ dayOffset, type }) => {
      const meta = SESSION_META[type];
      const durationMin = scaleDuration(meta.baseDurationMin, weekIntensity);
      const occurrence = typeOccurrence.get(type) ?? 0;
      typeOccurrence.set(type, occurrence + 1);
      return {
        dayOffset,
        time: dayOffset >= 5 ? "10h00" : "18h00",
        type,
        title: meta.title,
        durationMin,
        focus: meta.focus,
        intensity: weekIntensity,
        equipment: SESSION_EQUIPMENT[type],
        setupNotes: buildSetupNotes(type, horse, weekIntensity, durationMin),
        exercises: buildExercises(type, occurrence, horse, rider.primaryGoal, durationMin),
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
