import type { Discipline, ExerciseStep, HorseLevel, SafetyHorseInput, SessionIntensity, SessionStepPhase, SessionType } from "./types";

/**
 * Contenu réel des séances (exercices, matériel, repères techniques chiffrés)
 * — déplacé depuis apps/mobile/src/program/rules.ts pour que
 * /api/program-week puisse remplir une séance avec du contenu vétérinaire/
 * pédagogique déjà vérifié plutôt que de laisser l'IA inventer des chiffres
 * de sécurité (hauteur de saut, écartement de barres...). L'IA (cf. la route)
 * ne choisit que le TYPE et l'INTENSITÉ de la séance ; tout le contenu concret
 * vient d'ici.
 */

export const DISCIPLINE_POOL: Record<Discipline, SessionType[]> = {
  SHOW_JUMPING: ["OBSTACLE", "BARRES_AU_SOL", "DRESSAGE_BASICS", "SORTIE_EXTERIEURE"],
  DRESSAGE: ["DRESSAGE_BASICS", "ASSOUPLISSEMENT", "TRAVAIL_A_PIED", "SORTIE_EXTERIEURE"],
  EVENTING: ["OBSTACLE", "DRESSAGE_BASICS", "SORTIE_EXTERIEURE", "RENFORCEMENT"],
  WESTERN: ["DRESSAGE_BASICS", "ASSOUPLISSEMENT", "TRAVAIL_A_PIED", "SORTIE_EXTERIEURE"],
  ENDURANCE: ["SORTIE_EXTERIEURE", "RENFORCEMENT", "ASSOUPLISSEMENT", "TRAVAIL_A_PIED"],
  LEISURE: ["SORTIE_EXTERIEURE", "TRAVAIL_A_PIED", "ASSOUPLISSEMENT"],
  ETHOLOGY: ["TRAVAIL_A_PIED", "ASSOUPLISSEMENT", "SORTIE_EXTERIEURE"],
};

type ExerciseStepDraft = { phase: SessionStepPhase; title: string; description: string };

/** 3 variantes par type pour qu'une même séance ne soit pas identique à
 * chaque occurrence — la rotation se fait sur le nombre de fois où CE type a
 * déjà été programmé pour ce cheval (cf. sessionLibrary.pickVariant), pas sur
 * un numéro de semaine brut. */
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

/** Matériel typiquement nécessaire selon le type de séance. */
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

const REFERENCE_HEIGHT_CM = 160;

const POLE_SPACING_BASE_CM: Record<"pas" | "trot" | "galop", number> = { pas: 85, trot: 135, galop: 330 };

function poleSpacingCm(gait: "pas" | "trot" | "galop", horse: SafetyHorseInput): number {
  const scale = (horse.heightCm ?? REFERENCE_HEIGHT_CM) / REFERENCE_HEIGHT_CM;
  return Math.round((POLE_SPACING_BASE_CM[gait] * scale) / 5) * 5;
}

const CANTER_STRIDE_CM = 350;
const LANDING_TAKEOFF_ALLOWANCE_CM = 350;

function lineDistanceCm(strides: number, horse: SafetyHorseInput): number {
  const scale = (horse.heightCm ?? REFERENCE_HEIGHT_CM) / REFERENCE_HEIGHT_CM;
  return Math.round(((strides * CANTER_STRIDE_CM + LANDING_TAKEOFF_ALLOWANCE_CM) * scale) / 10) * 10;
}

const JUMP_HEIGHT_RANGE_CM: Record<HorseLevel, [number, number]> = {
  UNTRAINED: [20, 40],
  CLUB: [40, 60],
  AMATEUR: [70, 90],
  PRO: [100, 120],
};

function jumpHeightCm(horse: SafetyHorseInput, intensity: SessionIntensity): number {
  const [low, high] = JUMP_HEIGHT_RANGE_CM[horse.level];
  if (intensity === "LOW") return low;
  if (intensity === "HIGH") return high;
  return Math.round((low + high) / 2 / 5) * 5;
}

const JUMP_COUNT_RANGE: Record<HorseLevel, [number, number]> = {
  UNTRAINED: [8, 12],
  CLUB: [12, 18],
  AMATEUR: [15, 20],
  PRO: [18, 25],
};

function jumpCount(horse: SafetyHorseInput, intensity: SessionIntensity): number {
  const [low, high] = JUMP_COUNT_RANGE[horse.level];
  if (intensity === "LOW") return low;
  if (intensity === "HIGH") return high;
  return Math.round((low + high) / 2);
}

function horseSizeCategory(heightCm: number): string {
  if (heightCm < 120) return "petit poney";
  if (heightCm < 148) return "poney";
  if (heightCm < 175) return "cheval";
  return "grand cheval";
}

function heightAssumptionNote(horse: SafetyHorseInput): string {
  if (horse.heightCm) {
    return `Repères ajustés à la taille de ${horse.name} (~${horse.heightCm} cm, ${horseSizeCategory(horse.heightCm)}).`;
  }
  return `Taille de ${horse.name} non renseignée : repères calculés pour un ${horseSizeCategory(REFERENCE_HEIGHT_CM)} standard (~${REFERENCE_HEIGHT_CM} cm) — renseigne sa taille au garrot dans sa fiche pour des repères ajustés à sa morphologie.`;
}

function transitionCount(durationMin: number): number {
  return Math.max(6, Math.round(durationMin / 4));
}

function inHandSplitMin(durationMin: number): { longe: number; main: number } {
  const longe = Math.round((durationMin * 0.5) / 5) * 5;
  return { longe, main: durationMin - longe };
}

const HILL_REPS_RANGE: Record<SessionIntensity, [number, number]> = {
  LOW: [3, 4],
  MEDIUM: [5, 6],
  HIGH: [7, 8],
};

function trotShareMin(durationMin: number): number {
  return Math.round((durationMin * 0.4) / 5) * 5;
}

/** Repères techniques chiffrés selon le type de séance — un complément
 * concret aux exercices, pas une prescription stricte : la hauteur/
 * l'écartement réels se règlent au ressenti du jour. */
export function buildSetupNotes(type: SessionType, horse: SafetyHorseInput, intensity: SessionIntensity, durationMin: number): string[] {
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

/** Pioche une variante d'exercices en rotation déterministe sur `occurrence`
 * (nombre de fois où ce type a déjà été programmé pour ce cheval) — jamais la
 * même variante deux fois de suite. */
export function buildExercises(type: SessionType, occurrence: number, sessionDurationMin: number): ExerciseStep[] {
  const meta = SESSION_META[type];
  const variants = meta.exerciseVariants;
  const variant = variants[occurrence % variants.length];
  const shares = [0.2, 0.35, 0.3, 0.15];
  return variant.map((step, i) => ({ ...step, durationMin: Math.max(1, Math.round(sessionDurationMin * (shares[i] ?? 0.25))) }));
}
