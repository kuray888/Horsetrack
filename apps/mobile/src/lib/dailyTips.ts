import type { Discipline } from "@/onboarding/store";
import { t } from "@/i18n";

/**
 * Conseil du jour de l'Accueil. Il n'y en avait que 4 : le même revenait tous
 * les 4 jours, ce qui se remarque dès la première semaine. Conseils généraux
 * de bon sens (jamais un avis vétérinaire), plus quelques-uns par discipline,
 * choisie à l'onboarding (RiderProfile.mainDiscipline).
 */
const GENERAL_TIPS: string[] = [
  t("Varie les allures à l'échauffement pour mieux préparer les muscles de ton cheval."),
  t("Un debrief de 2 minutes après la séance aide à mémoriser les progrès."),
  t("Étire ton cheval en fin de séance pour limiter les courbatures."),
  t("Mieux vaut une séance courte et régulière qu'une longue séance espacée."),
  t("Dix minutes de pas en début de séance, c'est le meilleur échauffement pour les articulations."),
  t("Termine toujours sur un exercice réussi : ton cheval retient la dernière chose qu'il a faite."),
  t("Un jour de repos par semaine aide ton cheval à récupérer, physiquement et mentalement."),
  t("Vérifie les pieds avant et après chaque séance : un caillou coincé se repère vite."),
  t("Passe la main sur les membres après le travail : chaleur ou gonflement se sentent avant de se voir."),
  t("Note ce qui a bien marché aujourd'hui : c'est ta base pour la prochaine séance."),
  t("Alterne le travail sur le plat, l'extérieur et le travail à pied pour garder ton cheval motivé."),
  t("Une selle mal ajustée peut changer tout le comportement : fais-la vérifier une fois par an."),
  t("L'eau fraîche à volonté reste la base, surtout après l'effort et par forte chaleur."),
  t("Garde un œil sur l'état corporel : les côtes doivent se sentir sous la main sans se voir."),
  t("Change d'exercice avant que ton cheval ne se lasse : la fraîcheur vaut mieux que la répétition."),
  t("Travaille autant à main gauche qu'à main droite pour un cheval bien équilibré."),
  t("Par temps chaud, travaille tôt le matin ou en fin de journée."),
  t("Après une séance intense, un retour au calme au pas rênes longues aide à récupérer."),
  t("Un cheval qui refuse n'est pas forcément têtu : douleur, peur ou incompréhension sont plus fréquentes."),
  t("Garde le carnet de santé à jour : vaccins et vermifuges se suivent mieux notés qu'en mémoire."),
  t("Le maréchal passe en général toutes les 6 à 8 semaines : note le prochain rendez-vous dès maintenant."),
  t("Le dentiste équin, c'est en général une visite par an, plus souvent pour les jeunes et les seniors."),
  t("Observe ton cheval au box ou au pré : son comportement au repos en dit long sur son état."),
  t("Un objectif précis pour la séance vaut mieux qu'une heure à « faire des tours »."),
  t("Les transitions nombreuses et bien préparées musclent le dos mieux que de longues lignes droites."),
  t("Récompense tout de suite : ton cheval fait le lien avec ce qu'il vient de faire dans les secondes qui suivent."),
  t("Ta respiration influence ton cheval : un cavalier détendu, c'est souvent un cheval détendu."),
  t("Contrôle régulièrement l'état de ton harnachement : sangles, étrivières et coutures s'usent."),
  t("Un cheval qui mange moins que d'habitude mérite qu'on l'observe de près."),
  t("Les séances de longe ou de travail à pied comptent aussi : note-les dans ton planning."),
  t("Avant un changement de foin ou d'aliment, fais une transition progressive sur plusieurs jours."),
  t("Photographie les ordonnances et factures au fil de l'eau : tout est prêt le jour où tu en as besoin."),
];

const DISCIPLINE_TIPS: Partial<Record<Discipline, string[]>> = {
  SHOW_JUMPING: [
    t("Sur le plat, travaille l'allongement et le raccourcissement du galop : c'est la clé des bonnes distances."),
    t("Limite le nombre de sauts par séance : la qualité compte plus que la quantité pour les articulations."),
    t("Des barres au sol avant de sauter aident ton cheval à trouver son rythme."),
    t("Marche le parcours en comptant tes foulées : tu montes plus sereinement quand tu as un plan."),
  ],
  HUNTER: [
    t("En hunter, la régularité du galop fait la note : travaille un rythme constant sur de grandes courbes."),
    t("Des tracés simples et fluides valent mieux que des tournants serrés : pense à la fluidité du parcours."),
    t("Le calme de ton cheval est jugé : finis ta détente avant qu'il ne s'énerve."),
  ],
  DRESSAGE: [
    t("Relis ta reprise la veille et visualise chaque figure : tu gagnes en précision le jour J."),
    t("Travaille les figures ailleurs qu'aux mêmes lettres pour que ton cheval n'anticipe pas."),
    t("Des pauses rênes longues pendant la séance détendent le dos et l'esprit."),
    t("La qualité des transitions compte autant que les figures elles-mêmes."),
  ],
  EVENTING: [
    t("En complet, le fond se construit sur la durée : planifie des séances de galop régulières."),
    t("Varie les terrains à l'entraînement pour que ton cheval reste sûr de lui en cross."),
    t("Après un cross, surveille les membres les jours suivants : chaleur et gonflement se repèrent tôt."),
  ],
  WESTERN: [
    t("Le travail au pas lent et régulier construit la décontraction recherchée en western."),
    t("Des arrêts nets demandent d'abord un cheval équilibré : prépare-les par des transitions."),
    t("Varie le travail pour garder ton cheval attentif à tes aides légères."),
  ],
  ENDURANCE: [
    t("Entraîne la récupération cardiaque : note la fréquence cardiaque après l'effort."),
    t("Habitue ton cheval à boire en route : c'est ce qui fait la différence sur les longues distances."),
    t("Augmente les distances progressivement, jamais plus de 10 % d'une semaine à l'autre."),
  ],
  ATTELAGE: [
    t("Contrôle le harnais avant chaque sortie : une pièce usée se remarque mieux à l'arrêt."),
    t("Travaille aussi ton cheval monté ou en longe : ça varie les efforts."),
    t("Les exercices de maniabilité à allure lente affinent la précision avant de gagner en vitesse."),
  ],
  LEISURE: [
    t("Avant une balade, préviens quelqu'un de ton itinéraire et de ton heure de retour."),
    t("Varie les parcours de balade pour garder ton cheval curieux et attentif."),
    t("En extérieur, un gilet réfléchissant rend cavalier et cheval visibles de loin."),
  ],
  ETHOLOGY: [
    t("Des séances courtes et positives construisent la confiance plus vite que les longues."),
    t("Observe la posture et les oreilles de ton cheval : il te dit quand il est prêt à apprendre."),
    t("Relâche la pression dès que ton cheval cherche la bonne réponse : c'est ce qui l'aide à comprendre."),
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
