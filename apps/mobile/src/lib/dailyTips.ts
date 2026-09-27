import type { Discipline } from "@/onboarding/store";

/**
 * Conseil du jour de l'Accueil. Il n'y en avait que 4 : le même revenait tous
 * les 4 jours, ce qui se remarque dès la première semaine. Conseils généraux
 * de bon sens (jamais un avis vétérinaire), plus quelques-uns par discipline,
 * choisie à l'onboarding (RiderProfile.mainDiscipline).
 */
const GENERAL_TIPS: string[] = [
  "Varie les allures à l'échauffement pour mieux préparer les muscles de ton cheval.",
  "Un debrief de 2 minutes après la séance aide à mémoriser les progrès.",
  "Étire ton cheval en fin de séance pour limiter les courbatures.",
  "Mieux vaut une séance courte et régulière qu'une longue séance espacée.",
  "Dix minutes de pas en début de séance, c'est le meilleur échauffement pour les articulations.",
  "Termine toujours sur un exercice réussi : ton cheval retient la dernière chose qu'il a faite.",
  "Un jour de repos par semaine aide ton cheval à récupérer, physiquement et mentalement.",
  "Vérifie les pieds avant et après chaque séance : un caillou coincé se repère vite.",
  "Passe la main sur les membres après le travail : chaleur ou gonflement se sentent avant de se voir.",
  "Note ce qui a bien marché aujourd'hui : c'est ta base pour la prochaine séance.",
  "Alterne le travail sur le plat, l'extérieur et le travail à pied pour garder ton cheval motivé.",
  "Une selle mal ajustée peut changer tout le comportement : fais-la vérifier une fois par an.",
  "L'eau fraîche à volonté reste la base, surtout après l'effort et par forte chaleur.",
  "Garde un œil sur l'état corporel : les côtes doivent se sentir sous la main sans se voir.",
  "Change d'exercice avant que ton cheval ne se lasse : la fraîcheur vaut mieux que la répétition.",
  "Travaille autant à main gauche qu'à main droite pour un cheval bien équilibré.",
  "Par temps chaud, travaille tôt le matin ou en fin de journée.",
  "Après une séance intense, un retour au calme au pas rênes longues aide à récupérer.",
  "Un cheval qui refuse n'est pas forcément têtu : douleur, peur ou incompréhension sont plus fréquentes.",
  "Garde le carnet de santé à jour : vaccins et vermifuges se suivent mieux notés qu'en mémoire.",
  "Le maréchal passe en général toutes les 6 à 8 semaines : note le prochain rendez-vous dès maintenant.",
  "Le dentiste équin, c'est en général une visite par an, plus souvent pour les jeunes et les seniors.",
  "Observe ton cheval au box ou au pré : son comportement au repos en dit long sur son état.",
  "Un objectif précis pour la séance vaut mieux qu'une heure à « faire des tours ».",
  "Les transitions nombreuses et bien préparées musclent le dos mieux que de longues lignes droites.",
  "Récompense tout de suite : ton cheval fait le lien avec ce qu'il vient de faire dans les secondes qui suivent.",
  "Ta respiration influence ton cheval : un cavalier détendu, c'est souvent un cheval détendu.",
  "Contrôle régulièrement l'état de ton harnachement : sangles, étrivières et coutures s'usent.",
  "Un cheval qui mange moins que d'habitude mérite qu'on l'observe de près.",
  "Les séances de longe ou de travail à pied comptent aussi : note-les dans ton planning.",
  "Avant un changement de foin ou d'aliment, fais une transition progressive sur plusieurs jours.",
  "Photographie les ordonnances et factures au fil de l'eau : tout est prêt le jour où tu en as besoin.",
];

const DISCIPLINE_TIPS: Partial<Record<Discipline, string[]>> = {
  SHOW_JUMPING: [
    "Sur le plat, travaille l'allongement et le raccourcissement du galop : c'est la clé des bonnes distances.",
    "Limite le nombre de sauts par séance : la qualité compte plus que la quantité pour les articulations.",
    "Des barres au sol avant de sauter aident ton cheval à trouver son rythme.",
    "Marche le parcours en comptant tes foulées : tu montes plus sereinement quand tu as un plan.",
  ],
  HUNTER: [
    "En hunter, la régularité du galop fait la note : travaille un rythme constant sur de grandes courbes.",
    "Des tracés simples et fluides valent mieux que des tournants serrés : pense à la fluidité du parcours.",
    "Le calme de ton cheval est jugé : finis ta détente avant qu'il ne s'énerve.",
  ],
  DRESSAGE: [
    "Relis ta reprise la veille et visualise chaque figure : tu gagnes en précision le jour J.",
    "Travaille les figures ailleurs qu'aux mêmes lettres pour que ton cheval n'anticipe pas.",
    "Des pauses rênes longues pendant la séance détendent le dos et l'esprit.",
    "La qualité des transitions compte autant que les figures elles-mêmes.",
  ],
  EVENTING: [
    "En complet, le fond se construit sur la durée : planifie des séances de galop régulières.",
    "Varie les terrains à l'entraînement pour que ton cheval reste sûr de lui en cross.",
    "Après un cross, surveille les membres les jours suivants : chaleur et gonflement se repèrent tôt.",
  ],
  WESTERN: [
    "Le travail au pas lent et régulier construit la décontraction recherchée en western.",
    "Des arrêts nets demandent d'abord un cheval équilibré : prépare-les par des transitions.",
    "Varie le travail pour garder ton cheval attentif à tes aides légères.",
  ],
  ENDURANCE: [
    "Entraîne la récupération cardiaque : note la fréquence cardiaque après l'effort.",
    "Habitue ton cheval à boire en route : c'est ce qui fait la différence sur les longues distances.",
    "Augmente les distances progressivement, jamais plus de 10 % d'une semaine à l'autre.",
  ],
  ATTELAGE: [
    "Contrôle le harnais avant chaque sortie : une pièce usée se remarque mieux à l'arrêt.",
    "Travaille aussi ton cheval monté ou en longe : ça varie les efforts.",
    "Les exercices de maniabilité à allure lente affinent la précision avant de gagner en vitesse.",
  ],
  LEISURE: [
    "Avant une balade, préviens quelqu'un de ton itinéraire et de ton heure de retour.",
    "Varie les parcours de balade pour garder ton cheval curieux et attentif.",
    "En extérieur, un gilet réfléchissant rend cavalier et cheval visibles de loin.",
  ],
  ETHOLOGY: [
    "Des séances courtes et positives construisent la confiance plus vite que les longues.",
    "Observe la posture et les oreilles de ton cheval : il te dit quand il est prêt à apprendre.",
    "Relâche la pression dès que ton cheval cherche la bonne réponse : c'est ce qui l'aide à comprendre.",
  ],
};

/** Conseil du jour, stable pour une journée. Avec une discipline connue, un
 * jour sur deux puise dans ses conseils, les autres dans les conseils
 * généraux — assez de variété pour ne pas se répéter avant des semaines. */
export function dailyTip(date: Date = new Date(), discipline?: Discipline | null): string {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  const specific = discipline ? DISCIPLINE_TIPS[discipline] : undefined;
  if (specific && specific.length > 0 && dayOfYear % 2 === 1) {
    return specific[Math.floor(dayOfYear / 2) % specific.length];
  }
  return GENERAL_TIPS[Math.floor(dayOfYear / (specific ? 2 : 1)) % GENERAL_TIPS.length];
}

export const ALL_TIPS_FOR_TESTS = { GENERAL_TIPS, DISCIPLINE_TIPS };
