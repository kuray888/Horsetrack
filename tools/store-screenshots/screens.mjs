/**
 * Contenu des visuels App Store. Chaque visuel : un mot-clé en tête (kicker),
 * un titre court dont les mots entre ** sont soulignés (lisible en vignette
 * dans les résultats de recherche), une phrase de bénéfice, la capture brute
 * correspondante (raw/<langue>/<capture>.png, cf. capture.sh), une
 * composition (layout) et, au besoin, des cartes découpées dans la capture
 * (callouts : [x, y, largeur, hauteur] en pixels de la capture brute).
 *
 * Règles (App Store 2.3.3 et 2.3.7) : l'app réelle en usage — les cartes
 * sont des morceaux de vraies captures —, aucun chiffre ni classement
 * inventé, aucune promesse que l'app ne tient pas.
 */
export const SCREENS = {
  hub: {
    capture: "hub",
    theme: "navy",
    layout: "hero",
    fr: { kicker: "La fiche du cheval", title: "Toute sa fiche\n**dans ta poche**", sub: "Santé, journal, budget, papiers, poids, alimentation : tout au même endroit." },
    en: { kicker: "Your horse's profile", title: "Their whole profile\n**in your pocket**", sub: "Health, journal, budget, papers, weight, feeding: all in one place." },
  },
  sante: {
    capture: "sante",
    theme: "cream",
    layout: "tilt",
    card: { source: "hub", crop: [53, 1644, 591, 383], width: 560, x: 70, y: 2150, rot: -5 },
    fr: { kicker: "Rappels", title: "Ne rate plus\n**aucun soin**", sub: "Vaccins, maréchal, véto, dentiste : un rappel avant chaque rendez-vous." },
    en: { kicker: "Reminders", title: "Never miss\n**a vet visit**", sub: "Vaccines, farrier, vet, dentist: a reminder before every appointment." },
  },
  today: {
    capture: "today",
    theme: "blue",
    layout: "hero",
    card: { source: "sante", crop: [53, 1124, 1215, 225], width: 900, x: 280, y: 2470, rot: 3 },
    fr: { kicker: "Accueil", title: "Ta journée\n**en un coup d'œil**", sub: "La séance du jour, la météo, et ce qui arrive ensuite." },
    en: { kicker: "Home", title: "Your barn day\n**at a glance**", sub: "Today's session, the weather, and what's coming next." },
  },
  planning: {
    capture: "planning",
    theme: "sky",
    layout: "tilt",
    fr: { kicker: "Planning", title: "Planifie\n**chaque séance**", sub: "Dressage, saut, longe, balade : la semaine de ton cheval, organisée." },
    en: { kicker: "Schedule", title: "Plan\n**every session**", sub: "Flatwork, jumping, lunging, hacks: your horse's week, organised." },
  },
  coach: {
    capture: "coach",
    theme: "copper",
    layout: "hero",
    card: { crop: [53, 1411, 1215, 388], width: 960, x: 188, y: 1948, rot: -2 },
    fr: { kicker: "Coach", title: "Un coach qui\n**connaît ton cheval**", sub: "Il répond d'après son carnet : séances, soins, dépenses, poids." },
    en: { kicker: "Coach", title: "A coach who\n**knows your horse**", sub: "It answers from their record: sessions, care, expenses, weight." },
  },
  budget: {
    capture: "budget",
    theme: "navy",
    layout: "tilt",
    card: { source: "hub", crop: [675, 2060, 593, 383], width: 520, x: 60, y: 1990, rot: -5 },
    fr: { kicker: "Budget", title: "Sache ce que\nton cheval **te coûte**", sub: "Pension, maréchal, véto : ce qui est payé, ce qui reste, où part l'argent." },
    en: { kicker: "Budget", title: "Know what\nyour horse **costs you**", sub: "Livery, farrier, vet: what's paid, what's due, where the money goes." },
  },
  partage: {
    capture: "partage",
    theme: "cream",
    layout: "hero",
    fr: { kicker: "Partage", title: "Partage avec ta\n**demi-pension**", sub: "Ta DP, ton coach ou ton groom suivent son planning et ses soins." },
    en: { kicker: "Sharing", title: "Share with your\n**part-loaner**", sub: "Your sharer, coach or groom follow their schedule and care." },
  },
  journal: {
    capture: "journal",
    theme: "blue",
    layout: "tilt",
    fr: { kicker: "Journal", title: "Garde chaque\n**souvenir**", sub: "Photos, vidéos et ressentis de chaque séance, mois après mois." },
    en: { kicker: "Journal", title: "Keep every\n**memory**", sub: "Photos, videos and notes from every session, month after month." },
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
