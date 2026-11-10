/**
 * Contenu des visuels App Store. Chaque visuel : un mot-clé en tête (kicker),
 * un titre court dont les mots entre ** sont soulignés (lisible en vignette
 * dans les résultats de recherche), une phrase de bénéfice, des pastilles
 * (chips) et une scène 3D : des téléphones (p) et des cartes découpées dans
 * les captures (c), chacun avec sa position, sa taille et ses rotations
 * (rx, ry, rz en degrés ; tz = profondeur en px).
 *
 * Règles (App Store 2.3.3 et 2.3.7) : l'app réelle en usage — les cartes
 * sont des morceaux de vraies captures —, aucun chiffre ni classement
 * inventé, aucune promesse que l'app ne tient pas. Les pastilles ne citent
 * que des choses que l'app propose réellement (types de soins, rôles…).
 */
export const SCREENS = {
  hub: {
    theme: "navy",
    scene: [
      { p: "today", w: 780, x: -70, y: 1180, rz: -9, ry: 20, rx: 4, tz: -60 },
      { p: "planning", w: 780, x: 580, y: 1180, rz: 9, ry: -20, rx: 4, tz: -60 },
      { p: "hub", w: 870, x: 210, y: 960, rz: 0, ry: 0, rx: 0, tz: 80 },
    ],
    fr: { kicker: "La fiche du cheval", title: "Toute sa fiche\n**dans ta poche**", sub: "Santé, journal, budget, papiers, poids : tout au même endroit." },
    en: { kicker: "Your horse's profile", title: "Their whole profile\n**in your pocket**", sub: "Health, journal, budget, papers, weight: all in one place." },
  },
  sante: {
    theme: "cream",
    scene: [
      { p: "sante", w: 1040, x: 230, y: 900, rz: 12, ry: -26, rx: 6, tz: 0 },
      { c: "hub", crop: [53, 1644, 591, 383], w: 470, x: 150, y: 1960, rz: -6, ry: 12, rx: 0, tz: 330 },
      { c: "sante", crop: [53, 1124, 1215, 225], w: 700, x: 330, y: 2380, rz: -3, ry: -8, rx: 0, tz: 330 },
    ],
    fr: { kicker: "Rappels", title: "Ne rate plus\n**aucun soin**", sub: "Un rappel avant chaque rendez-vous.", chips: ["Vaccins", "Maréchal", "Véto", "Dentiste"] },
    en: { kicker: "Reminders", title: "Never miss\n**a vet visit**", sub: "A reminder before every appointment.", chips: ["Vaccines", "Farrier", "Vet", "Dentist"] },
  },
  today: {
    theme: "blue",
    scene: [
      { p: "planning", w: 820, x: -210, y: 1110, rz: -9, ry: 24, rx: 3, tz: -80 },
      { p: "today", w: 940, x: 300, y: 820, rz: 6, ry: -16, rx: 3, tz: 60 },
      { c: "sante", crop: [53, 1124, 1215, 225], w: 700, x: 90, y: 2330, rz: -4, ry: 8, rx: 0, tz: 330 },
    ],
    fr: { kicker: "Accueil", title: "Ta journée\n**en un coup d'œil**", sub: "La séance du jour, et ce qui arrive ensuite." },
    en: { kicker: "Home", title: "Your barn day\n**at a glance**", sub: "Today's session, and what's coming next." },
  },
  planning: {
    theme: "sky",
    scene: [
      { p: "planning", w: 1140, x: 80, y: 860, rz: -17, ry: -24, rx: 10, tz: 0 },
    ],
    fr: { kicker: "Planning", title: "Planifie\n**chaque séance**", sub: "La semaine de ton cheval, organisée.", chips: ["Dressage", "Saut", "Longe", "Balade"] },
    en: { kicker: "Schedule", title: "Plan\n**every session**", sub: "Your horse's week, organised.", chips: ["Flatwork", "Jumping", "Lunging", "Hacking"] },
  },
  coach: {
    theme: "copper",
    scene: [
      { p: "coach", w: 990, x: 150, y: 860, rz: -2, ry: 18, rx: 4, tz: 0 },
      { c: "coach", crop: [53, 1411, 1215, 388], w: 860, x: 160, y: 1890, rz: -3, ry: -8, rx: 0, tz: 330 },
    ],
    fr: { kicker: "Coach", title: "Un coach qui\n**connaît ton cheval**", sub: "Il répond d'après son carnet.", chips: ["Séances", "Soins", "Dépenses", "Poids"] },
    en: { kicker: "Coach", title: "A coach who\n**knows your horse**", sub: "It answers from their record.", chips: ["Sessions", "Care", "Expenses", "Weight"] },
  },
  budget: {
    theme: "navy",
    scene: [
      { p: "budget", w: 1040, x: 240, y: 880, rz: 9, ry: -24, rx: 6, tz: 0 },
      { c: "hub", crop: [675, 2060, 593, 383], w: 470, x: 150, y: 2000, rz: -6, ry: 12, rx: 0, tz: 330 },
    ],
    fr: { kicker: "Budget", title: "Sache ce que\nton cheval **te coûte**", sub: "Ce qui est payé, ce qui reste, où part l'argent.", chips: ["Pension", "Maréchal", "Véto", "Alimentation"] },
    en: { kicker: "Budget", title: "Know what\nyour horse **costs you**", sub: "What's paid, what's due, where the money goes.", chips: ["Livery", "Farrier", "Vet", "Feed"] },
  },
  partage: {
    theme: "cream",
    scene: [
      { p: "hub", w: 820, x: -210, y: 1100, rz: -9, ry: 24, rx: 3, tz: -80 },
      { p: "partage", w: 940, x: 300, y: 830, rz: 6, ry: -16, rx: 3, tz: 60 },
    ],
    fr: { kicker: "Partage", title: "Partage avec ta\n**demi-pension**", sub: "Elle suit son planning et ses soins.", chips: ["Demi-pension", "Coach", "Groom", "Vétérinaire"] },
    en: { kicker: "Sharing", title: "Share with your\n**part-loaner**", sub: "They follow the schedule and care.", chips: ["Part-loaner", "Coach", "Groom", "Vet"] },
  },
  journal: {
    theme: "blue",
    scene: [
      { p: "planning", w: 800, x: 640, y: 1100, rz: 10, ry: -22, rx: 3, tz: -90 },
      { p: "journal", w: 990, x: 200, y: 860, rz: -8, ry: 20, rx: 6, tz: 40 },
    ],
    fr: { kicker: "Journal", title: "Garde chaque\n**souvenir**", sub: "Photos et ressentis de chaque séance.", chips: ["Photos", "Vidéos", "Ressentis"] },
    en: { kicker: "Journal", title: "Keep every\n**memory**", sub: "Photos and notes from every session.", chips: ["Photos", "Videos", "Moods"] },
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
