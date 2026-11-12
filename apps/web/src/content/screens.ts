import type { StaticImageData } from "next/image";
import accueil from "@/assets/screens/accueil.webp";
import budget from "@/assets/screens/budget.webp";
import coach from "@/assets/screens/coach.webp";
import ficheCheval from "@/assets/screens/fiche-cheval.webp";
import journal from "@/assets/screens/journal.webp";
import partage from "@/assets/screens/partage.webp";
import planning from "@/assets/screens/planning.webp";
import seanceDirect from "@/assets/screens/seance-direct.webp";
import seanceDirectDepart from "@/assets/screens/seance-direct-depart.webp";

/** Captures réelles de l'app 1.2.0 (iPhone détouré, fond transparent),
 * produites par tools/store-screenshots/site-phones.mjs à partir des captures
 * du simulateur. Le texte alternatif décrit ce que montre l'écran, pas le
 * message marketing autour. */
export const SCREENS = {
  accueil: {
    image: accueil,
    alt: "Écran d'accueil de Horsetrack : salutation, les deux chevaux, la séance de CSO du jour, les boutons « Planifier une séance » et « Démarrer une séance en direct », puis l'idée de séance du coach.",
  },
  coach: {
    image: coach,
    alt: "Coach IA : champ « Pose une question sur ton cheval », questions suggérées (prochain vermifuge, dépenses de maréchal, séances du mois) et une réponse tirée du carnet du cheval.",
  },
  seanceDirect: {
    image: seanceDirect,
    alt: "Séance en direct : chronomètre à 2 min 34, trot estimé, 481 mètres parcourus à 11,5 km/h, tracé du parcours et boutons Pause et Terminer.",
  },
  seanceDirectDepart: {
    image: seanceDirectDepart,
    alt: "Départ d'une séance en direct : choix du cheval et de l'activité, suivi du parcours par GPS et option « Prévenir mes proches ».",
  },
  planning: {
    image: planning,
    alt: "Planning en liste : 0 séance faite sur 4 cette semaine, puis les séances à venir (CSO aujourd'hui, dressage demain, balade jeudi).",
  },
  journal: {
    image: journal,
    alt: "Journal : séance de CSO du 8 novembre avec la photo du cheval et le ressenti « Super séance, il a sauté avec de la légèreté ».",
  },
  ficheCheval: {
    image: ficheCheval,
    alt: "Fiche du cheval Floy De Tus : photo, objectif de saison, et les rubriques santé, entraînement, journal et budget avec leurs chiffres du moment.",
  },
  partage: {
    image: partage,
    alt: "Partage du cheval : invitation par email et choix du rôle de la personne invitée (demi-pension, coach, cavalière, groom).",
  },
  budget: {
    image: budget,
    alt: "Budget : 597 € ce mois-ci et 1 800 € cette année, la répartition par catégorie (pension, maréchal, vétérinaire…) et l'historique mois par mois.",
  },
} satisfies Record<string, { image: StaticImageData; alt: string }>;

export type ScreenName = keyof typeof SCREENS;
