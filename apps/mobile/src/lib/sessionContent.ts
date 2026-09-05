import type { Horse } from "@/horses/store";
import type { HorseLevel, RiderGoal } from "@/onboarding/store";

/**
 * Bibliothèque de contenu de séance — exercices, matériel, repères
 * techniques chiffrés et restrictions de santé/blessure. Extrait de
 * l'ancien program/rules.ts (moteur de génération IA, retiré) : cette partie
 * était déjà 100% déterministe et indépendante de l'IA, réutilisable telle
 * quelle pour suggérer du contenu lors de la création manuelle d'une séance
 * (cf. sessions/store.tsx) — seule la sélection automatique du programme
 * (répartition sur la semaine, progression par phase) a été abandonnée avec
 * l'IA, pas le contenu lui-même.
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

/** Phase d'une séance — sert à regrouper les exercices à l'affichage
 * (échauffement / corps de séance / retour au calme). */
export type SessionStepPhase = "ECHAUFFEMENT" | "CORPS_DE_SEANCE" | "RETOUR_AU_CALME";

export type ExerciseStep = {
  phase: SessionStepPhase;
  title: string;
  description: string;
  /** Durée indicative de ce bloc précis, en minutes — calculée au prorata de
   * la durée totale de la séance, pour qu'une séance se lise comme un vrai
   * déroulé chronométré plutôt qu'une liste d'idées sans repère de temps. */
  durationMin: number;
};

type ExerciseStepDraft = { phase: SessionStepPhase; title: string; description: string };

/** 3 variantes par type pour qu'une même séance ne soit pas identique à
 * chaque occurrence dans le programme — la rotation se fait sur le nombre de
 * fois où CE type a déjà été programmé (cf. `buildExercises`), pas sur le
 * numéro de semaine brut, donc même un cheval qui voit le même type revenir
 * souvent ne retombe sur la même variante qu'après les 3 avoir vues. Chaque
 * exercice porte une description (comment le faire / à quoi veiller) et une
 * phase d'affichage. */
export const SESSION_META: Record<
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
export const SESSION_EQUIPMENT: Record<SessionType, string[]> = {
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
export function buildSetupNotes(
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
export const HEALTH_CONDITION_RULES: Record<string, { excludeTypes: SessionType[]; maxIntensity?: SessionIntensity; note: string }> = {
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
/** Pioche un élément d'une liste en rotation déterministe sur l'index donné —
 * utilisé pour faire tourner points faibles et variantes d'exercices au fil
 * des semaines plutôt que de toujours utiliser le premier. */
function rotate<T>(list: T[], index: number): T | undefined {
  if (list.length === 0) return undefined;
  return list[index % list.length];
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
export function buildExercises(
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

/** Plafonne une intensité à un maximum donné — utilisé pour appliquer les
 * restrictions de santé/blessure ci-dessus à l'intensité choisie par le
 * cavalier lors de la création manuelle d'une séance. */
export function capAt(current: SessionIntensity, max: SessionIntensity): SessionIntensity {
  const order: SessionIntensity[] = ["LOW", "MEDIUM", "HIGH"];
  return order.indexOf(current) > order.indexOf(max) ? max : current;
}

