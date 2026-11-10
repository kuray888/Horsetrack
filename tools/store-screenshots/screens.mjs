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
  closing: {
    theme: "navy",
    kind: "closing",
    icon: "pets",
    badge: { x: 365, y: 1640, s: 560 },
    sparkles: [{ x: 130, y: 1760, s: 50 }, { x: 1080, y: 1700, s: 62 }, { x: 1110, y: 2300, s: 40 }, { x: 150, y: 2250, s: 34 }],
    features: [
      { icon: "notifications_active", fr: "Rappels de soins", en: "Care reminders" },
      { icon: "calendar_month", fr: "Planning", en: "Schedule" },
      { icon: "route", fr: "Séance en direct", en: "Live ride" },
      { icon: "auto_awesome", fr: "Coach IA", en: "AI coach" },
      { icon: "payments", fr: "Budget", en: "Budget" },
      { icon: "photo_camera", fr: "Journal photo", en: "Photo journal" },
      { icon: "group", fr: "Partage d'équipe", en: "Team sharing" },
      { icon: "folder_open", fr: "Coffre-fort", en: "Document vault" },
    ],
    fr: { kicker: "Horsetrack", title: "Ton cheval,\n**au même endroit**", sub: "Gratuit pour 1 cheval. Premium pour en suivre autant que tu veux.", cta: "Télécharge Horsetrack" },
    en: { kicker: "Horsetrack", title: "Your horse,\n**in one place**", sub: "Free for 1 horse. Premium for as many as you like.", cta: "Download Horsetrack" },
    scene: [],
  },
  hub: {
    theme: "navy",
    icon: "pets",
    noKicker: true,
    badge: { x: 900, y: 70, s: 340 },
    sparkles: [{ x: 1140, y: 640, s: 64 }, { x: 790, y: 730, s: 38 }, { x: 70, y: 930, s: 46 }],
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
    icon: "notifications_active",
    stickers: [{ icon: "notifications_active", label: "Rappel la veille", x: 70, y: 860, rot: -6 }],
    arrows: [{ x: 360, y: 900, w: 200, h: 150, rot: 0 }],
    sparkles: [{ x: 1120, y: 780, s: 58 }, { x: 640, y: 1010, s: 34 }],
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
    icon: "today",
    stickers: [{ icon: "event_available", label: "Séance du jour", x: 70, y: 760, rot: -5 }],
    arrows: [{ x: 380, y: 800, w: 200, h: 150, rot: 0 }],
    sparkles: [{ x: 1130, y: 700, s: 54 }, { x: 560, y: 740, s: 32 }],
    scene: [
      { p: "planning", w: 820, x: -210, y: 1110, rz: -9, ry: 24, rx: 3, tz: -80 },
      { p: "today", w: 940, x: 300, y: 820, rz: 6, ry: -16, rx: 3, tz: 60 },
      { c: "sante", crop: [53, 1124, 1215, 225], w: 700, x: 90, y: 2330, rz: -4, ry: 8, rx: 0, tz: 330 },
    ],
    fr: { kicker: "Accueil", title: "Ta journée\n**en un coup d'œil**", sub: "La séance du jour, et ce qui arrive ensuite." },
    en: { kicker: "Home", title: "Your barn day\n**at a glance**", sub: "Today's session, and what's coming next." },
  },
  ride: {
    theme: "copper",
    icon: "route",
    stickers: [{ icon: "shield_with_heart", label: "Tes proches suivent ta position", x: 70, y: 790, rot: -4 }],
    arrows: [{ x: 420, y: 850, w: 200, h: 150, rot: 0 }],
    sparkles: [{ x: 1130, y: 700, s: 56 }, { x: 80, y: 1060, s: 34 }],
    scene: [
      { p: "ride-setup", w: 980, x: 40, y: 960, rz: -7, ry: 22, rx: 6, tz: -40 },
      { c: "ride", crop: [53, 380, 1215, 1340], w: 700, x: 520, y: 1640, rz: 5, ry: -10, rx: 0, tz: 330 },
    ],
    fr: { kicker: "Séance en direct", title: "Suis tes balades\n**en direct**", sub: "Chrono, distance, allures et tracé GPS.", chips: ["Chrono", "Distance", "Allures", "GPS"] },
    en: { kicker: "Live ride", title: "Track your rides\n**live**", sub: "Timer, distance, gaits and GPS route.", chips: ["Timer", "Distance", "Gaits", "GPS"] },
  },
  planning: {
    theme: "sky",
    icon: "calendar_month",
    stickers: [{ icon: "date_range", label: "Ta semaine, organisée", x: 70, y: 790, rot: -5 }],
    arrows: [{ x: 430, y: 840, w: 200, h: 150, rot: 0 }],
    sparkles: [{ x: 1130, y: 760, s: 56 }, { x: 80, y: 1040, s: 36 }],
    scene: [
      { p: "planning", w: 1140, x: 80, y: 860, rz: -17, ry: -24, rx: 10, tz: 0 },
    ],
    fr: { kicker: "Planning", title: "Planifie\n**chaque séance**", sub: "La semaine de ton cheval, organisée.", chips: ["Dressage", "Saut", "Longe", "Balade"] },
    en: { kicker: "Schedule", title: "Plan\n**every session**", sub: "Your horse's week, organised.", chips: ["Flatwork", "Jumping", "Lunging", "Hacking"] },
  },
  coach: {
    theme: "navy",
    icon: "auto_awesome",
    stickers: [{ icon: "auto_awesome", label: "Coach IA", x: 640, y: 770, rot: 4 }],
    sparkles: [{ x: 1130, y: 740, s: 62 }, { x: 960, y: 1790, s: 40 }, { x: 70, y: 1750, s: 34 }],
    scene: [
      { p: "coach", w: 990, x: 150, y: 860, rz: -2, ry: 18, rx: 4, tz: 0 },
      { c: "coach", crop: [53, 1411, 1215, 336], w: 860, x: 160, y: 1890, rz: -3, ry: -8, rx: 0, tz: 330 },
    ],
    fr: { kicker: "Coach IA", title: "Un coach IA qui\n**connaît ton cheval**", sub: "Une IA qui répond d'après son carnet.", chips: ["Séances", "Soins", "Dépenses", "Poids"] },
    en: { kicker: "AI coach", title: "An AI coach that\n**knows your horse**", sub: "An AI that answers from their record.", chips: ["Sessions", "Care", "Expenses", "Weight"] },
  },
  budget: {
    theme: "cream",
    icon: "payments",
    stickers: [{ icon: "payments", label: "Payé · À régler", x: 70, y: 860, rot: -6 }],
    arrows: [{ x: 360, y: 900, w: 200, h: 150, rot: 0 }],
    sparkles: [{ x: 1120, y: 790, s: 56 }, { x: 600, y: 1000, s: 32 }],
    scene: [
      { p: "budget", w: 1020, x: 170, y: 880, rz: 8, ry: -22, rx: 6, tz: 0 },
      { c: "hub", crop: [675, 2060, 593, 383], w: 470, x: 150, y: 2000, rz: -6, ry: 12, rx: 0, tz: 330 },
    ],
    fr: { kicker: "Budget", title: "Sache ce que\nton cheval **te coûte**", sub: "Ce qui est payé, ce qui reste, où part l'argent.", chips: ["Pension", "Maréchal", "Véto", "Alimentation"] },
    en: { kicker: "Budget", title: "Know what\nyour horse **costs you**", sub: "What's paid, what's due, where the money goes.", chips: ["Livery", "Farrier", "Vet", "Feed"] },
  },
  partage: {
    theme: "blue",
    icon: "group",
    stickers: [{ icon: "group", label: "Demi-pension, coach, groom", x: 70, y: 790, rot: -5 }],
    arrows: [{ x: 440, y: 830, w: 200, h: 150, rot: 0 }],
    sparkles: [{ x: 1130, y: 720, s: 54 }],
    scene: [
      { p: "hub", w: 820, x: -210, y: 1100, rz: -9, ry: 24, rx: 3, tz: -80 },
      { p: "partage", w: 940, x: 300, y: 830, rz: 6, ry: -16, rx: 3, tz: 60 },
    ],
    fr: { kicker: "Partage", title: "Partage avec ta\n**demi-pension**", sub: "Elle suit son planning et ses soins.", chips: ["Demi-pension", "Coach", "Groom", "Vétérinaire"] },
    en: { kicker: "Sharing", title: "Share with your\n**part-loaner**", sub: "They follow the schedule and care.", chips: ["Part-loaner", "Coach", "Groom", "Vet"] },
  },
  journal: {
    theme: "copper",
    icon: "photo_camera",
    stickers: [{ icon: "photo_camera", label: "Photos et vidéos", x: 70, y: 790, rot: -5 }],
    arrows: [{ x: 360, y: 830, w: 200, h: 150, rot: 0 }],
    sparkles: [{ x: 1130, y: 760, s: 56 }, { x: 640, y: 1000, s: 32 }],
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
  soins: ["hub", "sante", "today", "ride", "planning", "coach", "budget", "partage", "journal", "closing"],
  coach: ["coach", "today", "ride", "sante", "planning", "journal", "hub", "partage", "budget", "closing"],
  ecurie: ["hub", "partage", "sante", "budget", "ride", "planning", "today", "coach", "journal", "closing"],
};

/** Note affichée dans la médaille (vraie : à mettre à jour avec l'App Store). */
export const RATING = { score: { fr: "5,0", en: "5.0" }, count: { fr: "11 avis", en: "11 reviews" } };

/** Pastille de la première image de chaque jeu : un fait vrai (palier gratuit). */
export const PILL = { fr: "Gratuit pour 1 cheval", en: "Free for 1 horse" };

export const LOCALES = ["fr", "en"];

/** 6,9 pouces (iPhone 16/17 Pro Max), taille acceptée par App Store Connect,
 * qui la réduit lui-même pour les écrans plus petits. */
export const SIZE = { width: 1290, height: 2796 };
