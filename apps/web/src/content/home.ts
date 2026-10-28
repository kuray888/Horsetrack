import type { IconName } from "@/components/Icon";
import type { ScreenName } from "@/content/screens";
import { PRICING } from "@/content/site";

/**
 * Textes de la page d'accueil. Chaque promesse correspond à une fonction
 * réelle de l'app (cf. docs/fiche-app-store.md et legal/cgu.md) : ce qui est
 * réservé à Premium est signalé comme tel.
 */

export const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "calendar",
    title: "Planning",
    text: "Séances, soins et concours réunis dans un seul planning, en liste ou par mois, avec des filtres pour tout retrouver.",
  },
  {
    icon: "timer",
    title: "Séances",
    text: "Dressage, CSO, balade, longe ou repos : choisissez la durée et l'intensité, répétez la séance si besoin, cochez-la une fois faite.",
  },
  {
    icon: "syringe",
    title: "Soins & santé",
    text: "Véto, maréchal, ostéo, dentiste, vaccins, vermifuges : chaque soin est noté avec sa prochaine échéance, et un rappel vous prévient.",
  },
  {
    icon: "trophy",
    title: "Concours",
    text: "Vos concours dans le planning, détaillés épreuve par épreuve avec Premium, et un rappel pour ne manquer aucun départ.",
  },
  {
    icon: "notebook",
    title: "Journal",
    text: "Ressenti, photo et météo du jour : gardez une trace de chaque séance et voyez les progrès s'installer.",
  },
  {
    icon: "wallet",
    title: "Budget",
    text: "Notez chaque dépense et sachez enfin ce que coûte votre cheval. Avec Premium, voyez ce qui est payé et ce qui reste à régler.",
  },
  {
    icon: "sun",
    title: "Suivi quotidien",
    text: "Chaque jour, l'accueil vous montre la météo, ce qui est à surveiller et vos prochains rendez-vous.",
  },
  {
    icon: "users",
    title: "À plusieurs",
    text: "Suivez tous vos chevaux et partagez l'accès avec votre demi-pension, votre coach ou votre groom (Premium).",
  },
];

export type Story = {
  id: string;
  eyebrow: string;
  tone: "copper" | "blue" | "sky";
  title: [string, string];
  text: string;
  bullets: string[];
  screens: ScreenName[];
};

export const STORIES: Story[] = [
  {
    id: "seances",
    eyebrow: "Séances",
    tone: "blue",
    title: ["Planifiez", "vos séances."],
    text: "Dressage, CSO, balade, longe ou repos : une séance se crée en quelques secondes. Choisissez la date, la durée et l'intensité, répétez-la si besoin, puis cochez-la une fois faite.",
    bullets: [
      "Six types de séance, de la longe au jour de repos",
      "Durée et intensité en un geste",
      "Séances répétées automatiquement",
      "Votre objectif de la semaine sur l'accueil",
    ],
    screens: ["nouvelleSeance"],
  },
  {
    id: "soins",
    eyebrow: "Soins & santé",
    tone: "copper",
    title: ["N'oubliez plus", "aucun soin."],
    text: "Maréchal, véto, ostéo, dentiste, vaccins, vermifuges : tout est noté sur la fiche de votre cheval, avec la prochaine échéance bien visible. Un rappel vous prévient avant chaque rendez-vous.",
    bullets: [
      "La prochaine échéance visible d'un coup d'œil",
      "Un rappel avant chaque rendez-vous",
      "Carnet de santé exportable en PDF pour le véto",
      "L'objectif de la saison toujours en vue",
    ],
    screens: ["ficheCheval"],
  },
  {
    id: "concours",
    eyebrow: "Concours",
    tone: "sky",
    title: ["Préparez", "vos concours."],
    text: "Vos concours prennent place dans le planning, à côté des séances et des soins. Détaillez-les épreuve par épreuve et activez un rappel pour ne rien laisser au hasard.",
    bullets: [
      "Concours, soins et séances dans un même planning",
      "Le détail épreuve par épreuve (Premium)",
      "Un rappel activé en un geste",
      "Des filtres pour n'afficher que ce qui compte",
    ],
    screens: ["planningConcours"],
  },
  {
    id: "journal",
    eyebrow: "Journal",
    tone: "copper",
    title: ["Suivez", "chaque progrès."],
    text: "Après la séance, notez votre ressenti et ajoutez une photo : la météo du jour s'enregistre toute seule. Au fil des semaines, votre journal raconte les progrès de votre cheval.",
    bullets: [
      "Le ressenti de chaque séance",
      "Vos photos, rangées par cheval",
      "La météo enregistrée automatiquement",
      "Un bilan du mois à partager",
    ],
    screens: ["journal"],
  },
  {
    id: "chevaux",
    eyebrow: "Vos chevaux",
    tone: "blue",
    title: ["Tous vos chevaux.", "Une seule app."],
    text: "Une fiche complète par cheval : discipline, niveau, race, mais aussi tempérament et points à travailler. Pour mieux le connaître, et le faire connaître à celles et ceux qui s'en occupent avec vous.",
    bullets: [
      "Tempérament et points à travailler",
      "Chevaux illimités avec Premium",
      "Partage avec votre demi-pension, votre coach ou votre groom (Premium)",
    ],
    screens: ["chevaux", "ajouterCheval"],
  },
];

export const LESS_ADMIN: { icon: IconName; before: string; after: string; premium?: boolean }[] = [
  {
    icon: "file",
    before: "Les ordonnances au fond du sac",
    after: "Photographiées, rangées dans le coffre-fort et retrouvées en deux secondes.",
    premium: true,
  },
  {
    icon: "bell",
    before: "Le vermifuge oublié",
    after: "Un rappel avant chaque soin, par notification, et aussi par email avec Premium.",
  },
  {
    icon: "notebook",
    before: "Le carnet resté à l'écurie",
    after: "Tout le suivi dans votre poche, et le carnet de santé en PDF à envoyer au véto.",
  },
  {
    icon: "wallet",
    before: "Le budget au doigt mouillé",
    after: "Chaque dépense notée, et avec Premium, ce qui est payé et ce qui reste à régler.",
  },
  {
    icon: "share",
    before: "Les consignes à répéter à la DP",
    after: "Votre demi-pension retrouve le planning, les soins et les rendez-vous du cheval.",
    premium: true,
  },
  {
    icon: "calendar",
    before: "La semaine griffonnée sur un coin de calendrier",
    after: "Toute la semaine d'un coup d'œil, et les séances cochées une fois faites.",
  },
];

export const STEPS: { title: string; text: string }[] = [
  {
    title: "Téléchargez Horsetrack",
    text: "Gratuitement sur l'App Store, puis créez votre compte avec votre email ou votre identifiant Apple.",
  },
  {
    title: "Créez la fiche de votre cheval",
    text: "Une photo, sa discipline, son niveau, son tempérament et ses points à travailler : quelques minutes suffisent.",
  },
  {
    title: "Planifiez, notez, profitez",
    text: "Ajoutez séances, soins et concours, activez les rappels : Horsetrack se souvient de tout, vous profitez de votre cheval.",
  },
];

export const PLANS = {
  free: {
    name: "Gratuit",
    price: "0 €",
    period: "sans limite de durée",
    audience: "Pour suivre un cheval au quotidien.",
    items: [
      "1 cheval",
      "Planning et séances",
      "Agenda des soins et rendez-vous",
      "Journal avec météo",
      "Suivi des dépenses",
      "1 rappel à la fois",
    ],
  },
  premium: {
    name: "Premium",
    price: PRICING.monthly,
    period: "par mois",
    alt: `ou ${PRICING.yearly} par an, soit ${(PRICING.yearlyValue / 12).toFixed(2).replace(".", ",")} € par mois`,
    badge: `${PRICING.trial} d'essai gratuit`,
    audience: "Pour tout suivre, à plusieurs et sans limite.",
    items: [
      "Chevaux illimités",
      "Rappels illimités, par notification et email",
      "Coffre-fort : ordonnances et factures en photo",
      "Partage avec votre DP, coach ou groom",
      "Concours détaillés épreuve par épreuve",
      "Dépenses payées et restant à régler",
    ],
  },
} as const;

export const FAQ: { q: string; a: string }[] = [
  {
    q: "Horsetrack est-il gratuit ?",
    a: `Oui. La version gratuite suit 1 cheval, sans limite de durée, avec le planning, l'agenda des soins, le journal, les dépenses et un rappel à la fois. Horsetrack Premium ajoute le reste, avec ${PRICING.trial} d'essai gratuit.`,
  },
  {
    q: "Que contient Horsetrack Premium ?",
    a: `Les chevaux et les rappels illimités (notification et email), le coffre-fort pour vos ordonnances et factures, le partage d'un cheval avec une personne (demi-pension, coach ou groom), le détail des concours épreuve par épreuve et le suivi de ce qui est payé ou reste à régler. ${PRICING.monthly} par mois ou ${PRICING.yearly} par an, après ${PRICING.trial} d'essai.`,
  },
  {
    q: "Sur quels appareils fonctionne Horsetrack ?",
    a: "Horsetrack est une application iPhone, à télécharger gratuitement sur l'App Store.",
  },
  {
    q: "Puis-je partager mon cheval avec ma demi-pension ou mon coach ?",
    a: "Oui, avec Premium : invitez une personne par cheval (demi-pension, coach ou groom) en un message. Elle retrouve le planning, les soins et les rendez-vous du cheval.",
  },
  {
    q: "Comment fonctionnent les rappels ?",
    a: "Pour chaque soin ou rendez-vous, activez un rappel : Horsetrack vous envoie une notification avant l'échéance. La version gratuite permet un rappel à la fois ; Premium les rend illimités et ajoute l'envoi par email.",
  },
  {
    q: "Mes données sont-elles protégées ?",
    a: "Horsetrack ne contient aucune publicité ni aucun traceur publicitaire, et vos données ne sont pas revendues. Vous pouvez verrouiller l'app avec Face ID et supprimer votre compte à tout moment depuis Profil → Supprimer mon compte.",
  },
  {
    q: "Comment annuler mon abonnement ?",
    a: "L'abonnement est géré par Apple : annulez-le quand vous voulez dans Réglages → votre nom → Abonnements, sur votre iPhone. Pour éviter toute facturation à la fin de l'essai gratuit, annulez au moins 24 heures avant son terme.",
  },
  {
    q: "Horsetrack remplace-t-il mon vétérinaire ?",
    a: "Non. Horsetrack est un outil d'organisation : il vous aide à ne rien oublier, mais ne donne aucun avis médical. Pour la santé de votre cheval, l'avis d'un vétérinaire reste indispensable.",
  },
  {
    q: "Comment contacter l'équipe ?",
    a: "Écrivez-nous à horsetrack.app@gmail.com, ou depuis l'app (Profil → Contacter le support). Nous répondons sous quelques jours ouvrés.",
  },
];

export const MARQUEE = [
  "Planning",
  "Séances",
  "Soins & santé",
  "Concours",
  "Journal",
  "Budget",
  "Rappels",
  "Plusieurs chevaux",
  "Partage avec la DP",
];
