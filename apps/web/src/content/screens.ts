import type { StaticImageData } from "next/image";
import accueil from "@/assets/screens/accueil.webp";
import ajouterCheval from "@/assets/screens/ajouter-cheval.webp";
import chevaux from "@/assets/screens/chevaux.webp";
import ficheCheval from "@/assets/screens/fiche-cheval.webp";
import journal from "@/assets/screens/journal.webp";
import nouvelleSeance from "@/assets/screens/nouvelle-seance.webp";
import planningConcours from "@/assets/screens/planning-concours.webp";

/** Captures réelles de l'app (détourées depuis les visuels App Store par
 * scripts/extract-screens.mjs). Le texte alternatif décrit ce que montre
 * l'écran, pas le message marketing autour. */
export const SCREENS = {
  accueil: {
    image: accueil,
    alt: "Écran d'accueil de Horsetrack : salutation, météo des prochains jours, chevaux, alerte « Concours dans 5 jours » et bouton « Planifier une séance ».",
  },
  nouvelleSeance: {
    image: nouvelleSeance,
    alt: "Création d'une séance : type (dressage, CSO, balade, longe, repos), date, heure, durée, intensité et répétition.",
  },
  ficheCheval: {
    image: ficheCheval,
    alt: "Fiche du cheval Floy De Tus : photo, objectif de saison, maréchal-ferrant dans 30 jours, entraînement, concours et journal.",
  },
  planningConcours: {
    image: planningConcours,
    alt: "Planning en liste : concours de reprise le 19 septembre avec rappel activé, puis les événements passés (balade, ferrure).",
  },
  journal: {
    image: journal,
    alt: "Journal : séance de CSO du 8 septembre avec photo du saut, ressenti « Top » et météo (pluie, 22 °C).",
  },
  chevaux: {
    image: chevaux,
    alt: "Liste des chevaux : Floy De Tus et Gin Tonic De Laume, avec le prochain passage du maréchal-ferrant.",
  },
  ajouterCheval: {
    image: ajouterCheval,
    alt: "Ajout d'un cheval : niveau de forme, charge de travail, tempérament et points à travailler.",
  },
} satisfies Record<string, { image: StaticImageData; alt: string }>;

export type ScreenName = keyof typeof SCREENS;
