/**
 * Configuration du site vitrine : adresses, liens sortants, prix affichés.
 * Tout ce qui peut changer sans toucher à la mise en page est ici.
 */

/** Origine https d'une adresse lue dans l'environnement au build. Une valeur
 * mal saisie fait échouer le build plutôt que de publier des balises
 * canoniques ou des liens faux (http accepté pour localhost uniquement). */
function httpsOrigin(name: string, raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error(`${name} doit être une adresse https (reçu : ${raw})`);
  }
  return url.origin;
}

/** Adresse publique du site (URL canonique, sitemap, Open Graph) : `SITE_URL`
 * (le domaine définitif), sinon le domaine de production fourni par Vercel,
 * sinon le serveur local. */
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
export const SITE_URL = httpsOrigin(
  "SITE_URL",
  process.env.SITE_URL ?? (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3002")
);

export const SITE_NAME = "Horsetrack";
export const SITE_TAGLINE = "Toute votre vie équestre, au même endroit.";
export const SITE_DESCRIPTION =
  "Planning, séances, soins, concours, journal et budget : Horsetrack réunit tout le suivi de vos chevaux dans une app iPhone. Gratuit pour 1 cheval.";

/** Date de dernière mise à jour du contenu (sitemap). */
export const CONTENT_UPDATED = "2026-10-06";

export const APP_STORE_ID = "6786889092";
export const APP_STORE_URL = `https://apps.apple.com/fr/app/horsetrack/id${APP_STORE_ID}`;

export const CONTACT_EMAIL = "horsetrack.app@gmail.com";

/** Les pages légales de l'app (CGU, confidentialité, support) sont servies
 * par l'API (apps/api) : ce sont les adresses déclarées sur l'App Store, on
 * y renvoie plutôt que d'en maintenir une seconde copie. */
const LEGAL_BASE_URL = httpsOrigin("LEGAL_BASE_URL", process.env.LEGAL_BASE_URL ?? "https://api-mu-tan-94.vercel.app");

export const LINKS = {
  privacy: `${LEGAL_BASE_URL}/confidentialite`,
  terms: `${LEGAL_BASE_URL}/cgu`,
  support: `${LEGAL_BASE_URL}/support`,
  accountDeletion: `${LEGAL_BASE_URL}/suppression-compte`,
  legalNotice: "/mentions-legales",
  email: `mailto:${CONTACT_EMAIL}`,
} as const;

/** Prix France TTC, tels qu'affichés dans App Store Connect (cf.
 * docs/fiche-app-store.md). Le prix de référence reste celui affiché dans
 * l'app avant tout engagement. */
export const PRICING = {
  monthly: "3,99 €",
  yearly: "39,99 €",
  monthlyValue: 3.99,
  yearlyValue: 39.99,
  trial: "1 mois",
} as const;

/** Éditeur et hébergeur (mentions légales, LCEN art. 6). */
export const PUBLISHER = {
  name: "Léa Lilou VERCASSON",
  status: "Entrepreneur individuel (micro-entreprise)",
  address: "14 Rue Robert Esnault-Pelterie, 78117 Toussus-le-Noble, France",
  siren: "981 898 125",
  siret: "981 898 125 00027",
} as const;

export const HOST = {
  name: "Vercel Inc.",
  address: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
  website: "https://vercel.com",
} as const;

export const NAV = [
  { href: "/#fonctionnalites", label: "Fonctionnalités" },
  { href: "/#comment-ca-marche", label: "Comment ça marche" },
  { href: "/#tarifs", label: "Tarifs" },
  { href: "/#faq", label: "FAQ" },
] as const;
