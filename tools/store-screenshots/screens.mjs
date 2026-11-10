/**
 * Contenu des visuels App Store : un titre court (lisible en vignette dans
 * les résultats de recherche), une phrase de bénéfice, et la capture brute
 * correspondante (raw/<langue>/<capture>.png, cf. capture.sh).
 *
 * Règles (App Store 2.3.3 et 2.3.7) : l'app réelle en usage, aucun chiffre
 * ni classement inventé, aucune promesse que l'app ne tient pas.
 */
export const SCREENS = {
  sante: {
    capture: "sante",
    theme: "navy",
    fr: { title: "Ne rate plus\naucun soin", sub: "Vaccins, maréchal, véto, dentiste : un rappel avant chaque rendez-vous." },
    en: { title: "Never miss\na vet visit", sub: "Vaccines, farrier, vet, dentist: a reminder before every appointment." },
  },
  today: {
    capture: "today",
    theme: "sky",
    fr: { title: "Ta journée d'écurie\nen un coup d'œil", sub: "La séance du jour, la météo, et ce qui arrive ensuite." },
    en: { title: "Your barn day\nat a glance", sub: "Today's session, the weather, and what's coming next." },
  },
  planning: {
    capture: "planning",
    theme: "blue",
    fr: { title: "Planifie\nchaque séance", sub: "Dressage, saut, longe, balade : la semaine de ton cheval, organisée." },
    en: { title: "Plan\nevery session", sub: "Flatwork, jumping, lunging, hacks: your horse's week, organised." },
  },
  coach: {
    capture: "coach",
    theme: "copper",
    fr: { title: "Un coach qui\nconnaît ton cheval", sub: "La prochaine séance expliquée d'après ses dernières semaines et sa santé." },
    en: { title: "A coach who\nknows your horse", sub: "Your next session, explained from their recent weeks and health." },
  },
  hub: {
    capture: "hub",
    theme: "navy",
    fr: { title: "Toute sa fiche\ndans ta poche", sub: "Santé, journal, budget, papiers, poids, alimentation : tout au même endroit." },
    en: { title: "Their whole profile\nin your pocket", sub: "Health, journal, budget, papers, weight, feeding: all in one place." },
  },
  budget: {
    capture: "budget",
    theme: "cream",
    fr: { title: "Sache ce que ton\ncheval te coûte", sub: "Pension, maréchal, véto : ce qui est payé, ce qui reste, où part l'argent." },
    en: { title: "Know what your\nhorse costs you", sub: "Livery, farrier, vet: what's paid, what's due, where the money goes." },
  },
  partage: {
    capture: "partage",
    theme: "blue",
    fr: { title: "Partage avec ta\ndemi-pension", sub: "Ta DP, ton coach ou ton groom suivent son planning et ses soins." },
    en: { title: "Share with your\npart-loaner", sub: "Your sharer, coach or groom follow their schedule and care." },
  },
  journal: {
    capture: "journal",
    theme: "copper",
    fr: { title: "Garde chaque\nsouvenir", sub: "Photos, vidéos et ressentis de chaque séance, mois après mois." },
    en: { title: "Keep every\nmemory", sub: "Photos, videos and notes from every session, month after month." },
  },
};

/**
 * Jeux pour les tests de page produit d'Apple (Product Page Optimization :
 * jusqu'à 3 variantes face à la page actuelle). Même contenu, ordre
 * différent : seul l'angle d'entrée change, la mesure dit lequel convertit.
 * - soins : le besoin le plus fort (ne rien oublier) — à mettre en page par défaut ;
 * - coach : la nouveauté différenciante ;
 * - ecurie : propriétaires de plusieurs chevaux, demi-pension, pros.
 */
export const SETS = {
  soins: ["hub", "sante", "today", "planning", "coach", "budget", "partage", "journal"],
  coach: ["coach", "today", "sante", "planning", "journal", "hub", "partage", "budget"],
  ecurie: ["hub", "partage", "sante", "budget", "planning", "today", "coach", "journal"],
};

/** Pastille de la première image de chaque jeu : un fait vrai (palier gratuit). */
export const PILL = { fr: "Gratuit pour 1 cheval", en: "Free for 1 horse" };

export const LOCALES = ["fr", "en"];

/** 6,9 pouces (iPhone 16/17 Pro Max), taille acceptée par App Store Connect,
 * qui la réduit lui-même pour les écrans plus petits. */
export const SIZE = { width: 1290, height: 2796 };
