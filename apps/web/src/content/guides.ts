/**
 * Guides pratiques : une page par vraie question de cavalier (ce que l'on
 * tape dans Google), qui y répond franchement puis montre comment Horsetrack
 * règle le problème au quotidien.
 *
 * Santé : repères généraux uniquement, jamais une posologie ni une règle
 * fédérale recopiée de mémoire — on renvoie au vétérinaire et au règlement.
 * Coûts : ordres de grandeur annoncés comme tels.
 */

export type GuideBlock =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "tip"; text: string };

export type GuideSection = { heading: string; blocks: GuideBlock[] };

export type Guide = {
  slug: string;
  title: string;
  /** Balise <title> et résultat Google (≤ 60 caractères conseillés). */
  seoTitle: string;
  description: string;
  /** Ce que l'app fait pour ce besoin, en une phrase (encadré final). */
  appPitch: string;
  updated: string;
  readingMinutes: number;
  sections: GuideSection[];
  related: string[];
};

export const GUIDES: Guide[] = [
  {
    slug: "carnet-de-sante-cheval",
    title: "Tenir le carnet de santé de son cheval sans rien oublier",
    seoTitle: "Carnet de santé du cheval : quoi noter, quand, comment",
    description:
      "Vaccins, vermifuges, maréchal, dentiste, ostéopathe : ce qu'il faut noter dans le suivi de santé de votre cheval et comment ne plus rater une échéance.",
    appPitch:
      "Horsetrack garde tout le suivi de santé de chaque cheval et vous prévient avant chaque échéance : vaccin, vermifuge, maréchal, dentiste.",
    updated: "2026-11-08",
    readingMinutes: 5,
    related: ["rappel-vermifuge-cheval", "marechal-ferrant-frequence", "cout-cheval-par-mois"],
    sections: [
      {
        heading: "Pourquoi un suivi écrit change tout",
        blocks: [
          {
            type: "p",
            text: "Le livret officiel du cheval sert surtout à l'identification et aux vaccinations signées par le vétérinaire. Mais au quotidien, ce qui manque le plus souvent, c'est la vue d'ensemble : quand est passé le maréchal, quel vermifuge a été donné, à quand remonte le dernier contrôle des dents.",
          },
          {
            type: "p",
            text: "Un suivi tenu à jour évite les oublis, aide le vétérinaire à poser un diagnostic, et rassure le jour où le cheval change d'écurie ou est partagé avec une demi-pension.",
          },
        ],
      },
      {
        heading: "Ce qu'il faut noter",
        blocks: [
          {
            type: "list",
            items: [
              "Vaccinations : date, produit, vétérinaire, et date du prochain rappel.",
              "Vermifugation ou coproscopies : date, résultat ou produit utilisé.",
              "Maréchal-ferrant : ferrage ou parage, date, observations.",
              "Dentiste équin : date du dernier contrôle et ce qui a été fait.",
              "Ostéopathe, kiné, vétérinaire : motif de la visite et recommandations.",
              "Blessures, boiteries, traitements : début, évolution, reprise du travail.",
              "Poids et état général : utile pour ajuster la ration et repérer un changement.",
            ],
          },
        ],
      },
      {
        heading: "Les rythmes à garder en tête",
        blocks: [
          {
            type: "p",
            text: "Chaque soin a son rythme, mais il dépend de votre cheval, de son âge, de son travail et de son environnement. Les repères ci-dessous sont des ordres de grandeur : c'est votre vétérinaire qui fixe le bon calendrier.",
          },
          {
            type: "list",
            items: [
              "Vaccins : rappels réguliers, avec des exigences particulières si vous sortez en compétition (consultez le règlement de votre fédération).",
              "Maréchal : en général toutes les 6 à 8 semaines.",
              "Dentiste : un contrôle au moins une fois par an, souvent plus pour un jeune ou un vieux cheval.",
              "Vermifugation : de plus en plus raisonnée, à partir de coproscopies, plutôt qu'à date fixe.",
            ],
          },
          {
            type: "tip",
            text: "Notez toujours la date du prochain rendez-vous au moment où vous enregistrez un soin : c'est elle qui évite l'oubli.",
          },
        ],
      },
      {
        heading: "Papier, tableur ou application ?",
        blocks: [
          {
            type: "p",
            text: "Un carnet papier reste à l'écurie le jour où on en a besoin. Un tableur ne prévient de rien. Une application dédiée garde l'historique, range les ordonnances et factures, et envoie un rappel au bon moment, même pour plusieurs chevaux.",
          },
        ],
      },
    ],
  },
  {
    slug: "cout-cheval-par-mois",
    title: "Combien coûte un cheval par mois ?",
    seoTitle: "Combien coûte un cheval par mois ? Le détail poste par poste",
    description:
      "Pension, maréchal, vétérinaire, alimentation, assurance : les postes de dépense d'un cheval, des ordres de grandeur et une méthode pour suivre votre vrai budget.",
    appPitch:
      "Horsetrack suit chaque dépense de votre cheval, ce qui est payé et ce qui reste à régler, et vous montre où part votre budget mois après mois.",
    updated: "2026-11-08",
    readingMinutes: 6,
    related: ["organiser-demi-pension", "marechal-ferrant-frequence", "carnet-de-sante-cheval"],
    sections: [
      {
        heading: "La réponse courte",
        blocks: [
          {
            type: "p",
            text: "Le coût d'un cheval dépend d'abord de sa pension, qui représente souvent plus de la moitié du budget. Selon la région, le type d'hébergement et les services inclus, le total mensuel varie du simple au triple. Plutôt qu'un chiffre unique, mieux vaut additionner vos propres postes : utilisez notre calculateur gratuit.",
          },
        ],
      },
      {
        heading: "Les postes réguliers",
        blocks: [
          {
            type: "list",
            items: [
              "Pension : au pré, en box, avec ou sans travail, nourriture comprise ou non. C'est le premier poste.",
              "Maréchal-ferrant : parage ou ferrage, toutes les 6 à 8 semaines environ.",
              "Alimentation complémentaire : granulés, foin en plus, compléments, si la pension ne les inclut pas.",
              "Assurance : mortalité, frais vétérinaires, responsabilité civile, selon les formules.",
            ],
          },
        ],
      },
      {
        heading: "Les postes annuels, à lisser sur l'année",
        blocks: [
          {
            type: "list",
            items: [
              "Vaccins et visites vétérinaires de routine.",
              "Dentiste équin.",
              "Ostéopathe ou autres soins d'entretien.",
              "Vermifuges ou coproscopies.",
              "Équipement : tapis, couvertures, protections, entretien de la sellerie.",
              "Compétitions : engagements, transport, licence.",
            ],
          },
          {
            type: "tip",
            text: "Divisez chaque dépense annuelle par 12 et ajoutez-la à votre budget mensuel : c'est la seule façon de ne pas être surpris.",
          },
        ],
      },
      {
        heading: "Les imprévus",
        blocks: [
          {
            type: "p",
            text: "Une boiterie, une colique ou une blessure peuvent coûter en une fois l'équivalent de plusieurs mois de pension. Une assurance frais vétérinaires ou une réserve mise de côté chaque mois évite de devoir choisir entre le soin et le budget.",
          },
        ],
      },
      {
        heading: "Partager les frais",
        blocks: [
          {
            type: "p",
            text: "Une demi-pension permet de partager une partie des frais en échange de jours de monte. Mettez par écrit la participation, les jours et ce qui est inclus : cela évite les malentendus.",
          },
        ],
      },
    ],
  },
  {
    slug: "rappel-vermifuge-cheval",
    title: "Vermifuger son cheval : quand, et comment ne plus oublier",
    seoTitle: "Vermifuge du cheval : rythme, coproscopie et rappels",
    description:
      "Vermifugation raisonnée, coproscopies, saisons : les principes à connaître et une méthode simple pour ne plus oublier le prochain vermifuge.",
    appPitch:
      "Notez chaque vermifuge ou coproscopie dans Horsetrack : l'app vous rappelle la prochaine échéance et garde l'historique pour votre vétérinaire.",
    updated: "2026-11-08",
    readingMinutes: 4,
    related: ["carnet-de-sante-cheval", "cout-cheval-par-mois", "marechal-ferrant-frequence"],
    sections: [
      {
        heading: "Vermifuger moins, mais mieux",
        blocks: [
          {
            type: "p",
            text: "Vermifuger systématiquement à date fixe favorise les résistances des parasites aux produits. Les vétérinaires recommandent de plus en plus une approche raisonnée : analyser les crottins (coproscopie) et ne traiter que les chevaux qui en ont besoin, avec le bon produit.",
          },
        ],
      },
      {
        heading: "Ce qui influence le calendrier",
        blocks: [
          {
            type: "list",
            items: [
              "L'âge du cheval : les jeunes sont plus sensibles.",
              "Le mode de vie : pré partagé, nombre de chevaux, rotation des parcelles.",
              "La saison : certains parasites se traitent à des périodes précises.",
              "Les résultats des coproscopies précédentes.",
            ],
          },
          {
            type: "tip",
            text: "Demandez à votre vétérinaire un plan annuel pour votre cheval, puis enregistrez chaque échéance avec un rappel.",
          },
        ],
      },
      {
        heading: "Garder une trace",
        blocks: [
          {
            type: "p",
            text: "Notez la date, le produit ou le résultat d'analyse, et la date prévue du prochain contrôle. Cet historique est précieux si votre cheval change d'écurie ou de vétérinaire.",
          },
        ],
      },
    ],
  },
  {
    slug: "organiser-demi-pension",
    title: "Organiser une demi-pension qui se passe bien",
    seoTitle: "Demi-pension cheval : jours, frais, convention, organisation",
    description:
      "Jours de monte, participation aux frais, assurance, communication : comment organiser une demi-pension claire pour le propriétaire comme pour le cavalier.",
    appPitch:
      "Avec Horsetrack, partagez votre cheval avec votre demi-pension : planning, soins et rendez-vous à jour pour vous deux, et un fil privé pour échanger.",
    updated: "2026-11-08",
    readingMinutes: 5,
    related: ["cout-cheval-par-mois", "planning-entrainement-cheval", "carnet-de-sante-cheval"],
    sections: [
      {
        heading: "Mettre les règles par écrit",
        blocks: [
          {
            type: "p",
            text: "La plupart des tensions en demi-pension viennent de ce qui n'a pas été dit. Une convention simple, même d'une page, protège tout le monde.",
          },
          {
            type: "list",
            items: [
              "Les jours de monte, et ce qui se passe en cas d'empêchement.",
              "La participation aux frais : montant, échéance, ce qu'elle couvre.",
              "Le type de travail autorisé : balade, saut, longe, compétition.",
              "L'assurance : responsabilité civile du cavalier, licence.",
              "Les conditions de fin : préavis, période d'essai.",
            ],
          },
        ],
      },
      {
        heading: "Partager l'information",
        blocks: [
          {
            type: "p",
            text: "Le cavalier en demi-pension doit savoir quand passe le maréchal, si le cheval a reçu un vaccin, ou s'il faut l'épargner après une séance difficile. Un planning commun et un historique des soins accessibles aux deux évitent les messages perdus.",
          },
          {
            type: "tip",
            text: "Après chaque séance, une phrase suffit : ce qui a été travaillé et comment le cheval s'est senti.",
          },
        ],
      },
      {
        heading: "Faire le point régulièrement",
        blocks: [
          {
            type: "p",
            text: "Un point tous les deux ou trois mois permet d'ajuster les jours, le travail et la participation. Mieux vaut une discussion calme qu'un malentendu qui s'installe.",
          },
        ],
      },
    ],
  },
  {
    slug: "planning-entrainement-cheval",
    title: "Construire le planning d'entraînement de son cheval",
    seoTitle: "Planning d'entraînement du cheval : construire sa semaine",
    description:
      "Variété, progression, jours de repos : comment construire une semaine d'entraînement équilibrée pour votre cheval, que vous montiez en loisir ou en compétition.",
    appPitch:
      "Horsetrack planifie vos séances, vous rappelle celles du jour, suit votre semaine et propose la prochaine séance d'après le vécu de votre cheval.",
    updated: "2026-11-08",
    readingMinutes: 5,
    related: ["organiser-demi-pension", "carnet-de-sante-cheval", "cout-cheval-par-mois"],
    sections: [
      {
        heading: "Varier pour progresser",
        blocks: [
          {
            type: "p",
            text: "Un cheval qui fait toujours la même séance s'ennuie et se fatigue aux mêmes endroits. Alterner les types de travail entretient sa motivation et développe tout son corps.",
          },
          {
            type: "list",
            items: [
              "Travail sur le plat : souplesse, équilibre, transitions.",
              "Barres au sol ou saut : coordination, impulsion.",
              "Extérieur ou balade : mental, endurance, terrain varié.",
              "Longe ou travail à pied : utile pour varier ou alléger une semaine.",
            ],
          },
        ],
      },
      {
        heading: "Respecter la récupération",
        blocks: [
          {
            type: "p",
            text: "Après une séance intense ou un concours, une journée plus légère ou de repos aide le cheval à récupérer. Enchaîner plusieurs jours difficiles augmente le risque de blessure.",
          },
          {
            type: "tip",
            text: "Notez le ressenti après chaque séance : c'est le meilleur indicateur pour ajuster la suivante.",
          },
        ],
      },
      {
        heading: "Planifier sur la semaine",
        blocks: [
          {
            type: "p",
            text: "Posez d'abord les contraintes (jours de demi-pension, concours, venue du maréchal), puis répartissez les séances autour. Une semaine prévue à l'avance se tient beaucoup mieux qu'une séance décidée au dernier moment.",
          },
        ],
      },
    ],
  },
  {
    slug: "marechal-ferrant-frequence",
    title: "Maréchal-ferrant : tous les combien, et comment s'y retrouver",
    seoTitle: "Maréchal-ferrant : fréquence du ferrage et du parage",
    description:
      "Ferrage ou pieds nus, fréquence des passages, signes qu'il est temps d'appeler le maréchal : les repères pour bien suivre les pieds de votre cheval.",
    appPitch:
      "Enregistrez chaque passage du maréchal dans Horsetrack : l'app vous rappelle le suivant et garde l'historique des pieds de votre cheval.",
    updated: "2026-11-08",
    readingMinutes: 4,
    related: ["carnet-de-sante-cheval", "cout-cheval-par-mois", "rappel-vermifuge-cheval"],
    sections: [
      {
        heading: "Le rythme habituel",
        blocks: [
          {
            type: "p",
            text: "On compte en général 6 à 8 semaines entre deux passages, que le cheval soit ferré ou pieds nus. La pousse de la corne varie selon la saison, l'alimentation, le travail et le cheval lui-même : votre maréchal vous dira le bon intervalle.",
          },
        ],
      },
      {
        heading: "Les signes qu'il est temps",
        blocks: [
          {
            type: "list",
            items: [
              "Un fer qui bouge, se décale ou a été perdu.",
              "Des pieds trop longs ou qui se fendent.",
              "Un cheval qui trébuche plus souvent ou change d'allure.",
            ],
          },
          {
            type: "tip",
            text: "Prenez le prochain rendez-vous dès la fin du passage du maréchal et notez-le tout de suite.",
          },
        ],
      },
      {
        heading: "Garder l'historique",
        blocks: [
          {
            type: "p",
            text: "Noter la date, le type d'intervention et les observations permet de repérer un problème qui revient, et d'en parler avec votre vétérinaire si besoin.",
          },
        ],
      },
    ],
  },
];

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
