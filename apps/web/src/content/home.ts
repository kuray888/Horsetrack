import type { IconName } from "@/components/Icon";
import type { ScreenName } from "@/content/screens";
import { PRICING, PRICING_PRO } from "@/content/site";

/**
 * Textes de la page d'accueil. Chaque promesse correspond à une fonction
 * réelle de l'app (cf. docs/fiche-app-store.md et legal/cgu.md) : ce qui est
 * réservé à Premium est signalé comme tel.
 */

export const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "calendar",
    title: "Planning",
    text: "Séances, soins et concours réunis dans un seul planning, en liste ou par mois. Avec Premium, vos créneaux réguliers reviennent seuls chaque semaine.",
  },
  {
    icon: "route",
    title: "Séance en direct",
    text: "Lancez le chrono en selle : distance, vitesse, allures et tracé GPS s'enregistrent, même écran verrouillé. La première séance est offerte, les suivantes avec Premium.",
  },
  {
    icon: "bulb",
    title: "Coach IA",
    text: "Posez vos questions sur votre cheval : le coach répond d'après son carnet. 3 questions offertes pour l'essayer, puis Premium.",
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
    text: "Chaque dépense notée, et le total du mois. Avec Premium, la répartition par poste, le rapport du mois en PDF et l'export en tableur.",
  },
  {
    icon: "users",
    title: "À plusieurs",
    text: "Invitez gratuitement une personne par cheval en lecture seule. Avec Premium, choisissez son rôle : demi-pension, coach ou groom, chacun avec ses droits.",
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
    id: "seance-direct",
    eyebrow: "Séance en direct",
    tone: "blue",
    title: ["Montez.", "L'app compte pour vous."],
    text: "Choisissez le cheval et l'activité, touchez « Démarrer » : chrono, distance, vitesse et allures s'enregistrent pendant que vous montez, même téléphone en poche. À la fin, la séance rejoint votre planning avec son tracé.",
    bullets: [
      "Chrono, distance, vitesse et allures estimées",
      "Le tracé GPS de votre parcours",
      "Fonctionne écran verrouillé, et sans GPS en manège",
      "La première séance offerte, puis avec Premium",
      "En balade, « Prévenir mes proches » : une alerte si vous ne bougez plus (Premium)",
    ],
    screens: ["seanceDirectDepart", "seanceDirect"],
  },
  {
    id: "coach",
    eyebrow: "Coach IA",
    tone: "copper",
    title: ["Un coach qui connaît", "votre cheval."],
    text: "Quand a-t-il été vermifugé ? Combien avez-vous dépensé en maréchal cette année ? Le coach répond d'après le carnet de votre cheval, propose une idée de séance adaptée et résume votre mois. Il ne s'active qu'avec votre accord, et ne remplace jamais votre vétérinaire.",
    bullets: [
      "Des réponses tirées de vos séances, soins et dépenses",
      "Une idée de séance chaque jour, expliquée",
      "Le résumé de votre mois",
      "3 questions offertes pour l'essayer, puis Premium",
      "Rien n'est envoyé sans votre accord",
    ],
    screens: ["coach"],
  },
  {
    id: "soins",
    eyebrow: "Soins & santé",
    tone: "sky",
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
    id: "planning",
    eyebrow: "Planning & concours",
    tone: "blue",
    title: ["Toute la semaine,", "d'un coup d'œil."],
    text: "Séances, soins et concours prennent place dans un même planning. Cochez une séance d'un geste une fois faite, suivez votre semaine, et laissez vos créneaux réguliers revenir tout seuls.",
    bullets: [
      "Séances, soins et concours au même endroit",
      "La semaine en cours : faites et à venir",
      "Un widget : la séance du jour sur l'écran d'accueil",
      "Créneaux réguliers chaque semaine (Premium)",
      "Concours détaillés épreuve par épreuve (Premium)",
    ],
    screens: ["planning"],
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
    id: "budget",
    eyebrow: "Budget",
    tone: "sky",
    title: ["Sachez enfin ce que", "coûte votre cheval."],
    text: "Pension, maréchal, véto, alimentation : notez chaque dépense et voyez le total du mois et de l'année. Avec Premium, voyez où part votre budget poste par poste, ce qui reste à régler, et exportez tout pour vos comptes.",
    bullets: [
      "Le total du mois et de l'année",
      "La répartition par catégorie et ce qui reste à régler (Premium)",
      "Le rapport du mois en PDF (Premium)",
      "L'export de l'année en PDF ou en tableur (Premium)",
    ],
    screens: ["budget"],
  },
  {
    id: "partage",
    eyebrow: "À plusieurs",
    tone: "blue",
    title: ["Partagez votre cheval.", "Gardez la main."],
    text: "Invitez votre demi-pension, votre coach ou votre groom : il retrouve le planning, les soins et les rendez-vous du cheval. Chacun a les droits de son rôle, et votre budget reste à vous.",
    bullets: [
      "Une personne invitée par cheval, gratuitement, en lecture seule",
      "Avec Premium, un rôle et des droits : la DP note ses séances",
      "Votre budget et vos documents restent privés",
      "Chevaux illimités avec Premium",
    ],
    screens: ["partage"],
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
      "Planning, séances et agenda des soins",
      "1 séance en direct offerte",
      "Partage d'un cheval en lecture seule",
      "3 questions offertes au coach IA",
      "Journal avec météo",
      "Suivi des dépenses",
      "Objectifs",
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
      "Séances en direct : chrono, GPS, allures et tracé",
      "Coach IA : 30 questions par mois, idée de séance, résumé du mois",
      "Le meilleur moment pour monter, chaque jour, d'après la météo",
      "Rappels illimités, par notification et email",
      "Coffre-fort : ordonnances et factures en photo",
      "Partage avec votre DP, coach ou groom",
      "Sécurité en balade : vos proches prévenus si vous ne bougez plus",
      "Concours détaillés épreuve par épreuve",
      "Budget détaillé, rapport du mois en PDF et export en tableur",
      "Créneaux réguliers chaque semaine",
    ],
  },
  pro: {
    name: "Écurie Pro",
    price: PRICING_PRO.monthly,
    period: "par mois",
    alt: `ou ${PRICING_PRO.yearly} par an, soit ${(PRICING_PRO.yearlyValue / 12).toFixed(2).replace(".", ",")} € par mois`,
    audience: "Pour plusieurs chevaux et toute une équipe autour d'eux.",
    items: [
      "Jusqu'à 5 personnes par cheval",
      "Un rôle pour chacun : DP, coach, groom, gérant, véto, maréchal",
      "Des droits adaptés : chacun note ses séances, le budget reste à vous",
      "Vue écurie : retards, échéances et dépenses de tous vos chevaux",
      "Tâches d'écurie, créneaux réguliers et planning de la semaine",
      "Espace gestionnaire sur ordinateur : planning et exports CSV",
      "Coach : trois fois plus de questions",
    ],
  },
} as const;

export const FAQ: { q: string; a: string }[] = [
  {
    q: "Horsetrack est-il gratuit ?",
    a: `Oui. La version gratuite suit 1 cheval, sans limite de durée, avec le planning, l'agenda des soins, le journal, les dépenses, un rappel à la fois, une séance en direct et 3 questions au coach IA offertes. Horsetrack Premium ajoute le reste, avec ${PRICING.trial} d'essai gratuit.`,
  },
  {
    q: "Que contient Horsetrack Premium ?",
    a: `Les séances en direct avec GPS, le coach IA, le meilleur moment pour monter selon la météo, les chevaux et les rappels illimités (notification et email), le coffre-fort pour vos ordonnances et factures, le partage d'un cheval avec une personne (demi-pension, coach ou groom), la sécurité en balade, le détail des concours épreuve par épreuve, le budget détaillé, les créneaux réguliers de la semaine, le rapport du mois en PDF et l'export des dépenses en PDF ou tableur. ${PRICING.monthly} par mois ou ${PRICING.yearly} par an, après ${PRICING.trial} d'essai.`,
  },
  {
    q: "Sur quels appareils fonctionne Horsetrack ?",
    a: "Horsetrack est une application iPhone, à télécharger gratuitement sur l'App Store.",
  },
  {
    q: "Puis-je partager mon cheval avec ma demi-pension ou mon coach ?",
    a: "Oui. Gratuitement, invitez une personne par cheval en lecture seule : elle retrouve le planning, les soins et les rendez-vous. Avec Premium, choisissez son rôle et ses droits : une demi-pension note ses séances, un coach planifie, le budget reste visible par vous seul.",
  },
  {
    q: "Comment fonctionne le coach IA ?",
    a: "Posez une question sur votre cheval (3 questions offertes, puis 30 par mois avec Premium) : le coach répond d'après son carnet (séances, soins, dépenses, poids), propose une idée de séance et résume votre mois. Il ne s'active qu'après votre accord explicite, retirable à tout moment : seuls les faits utiles sont envoyés à notre prestataire d'IA, sans votre nom ni votre email. Il ne donne aucun avis médical ; pour un symptôme, il vous oriente vers votre vétérinaire.",
  },
  {
    q: "La séance en direct consomme-t-elle ma batterie ?",
    a: "Le GPS ne fonctionne que pendant la séance que vous avez lancée, et s'arrête dès que vous la terminez. En manège couvert, coupez le suivi du parcours : le chrono fonctionne sans GPS.",
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
  "Séance en direct",
  "Coach IA",
  "Séances",
  "Soins & santé",
  "Concours",
  "Journal",
  "Budget",
  "Rappels",
  "Plusieurs chevaux",
  "Partage avec la DP",
];
