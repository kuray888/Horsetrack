import { FAQ } from "@/content/home";
import { SCREENS } from "@/content/screens";
import {
  APP_STORE_URL,
  CONTACT_EMAIL,
  PRICING,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/content/site";

const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const APP_ID = `${SITE_URL}/#app`;

/** Graphe schema.org de la page d'accueil : la marque, le site, l'app et la
 * FAQ. Aucune note ni nombre d'avis : on ne déclare que ce qui est vérifiable. */
export function homeStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/icons/icon-512.png`,
        email: CONTACT_EMAIL,
        sameAs: [APP_STORE_URL],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: CONTACT_EMAIL,
          availableLanguage: ["French"],
        },
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "fr-FR",
        publisher: { "@id": ORGANIZATION_ID },
      },
      {
        "@type": "MobileApplication",
        "@id": APP_ID,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        installUrl: APP_STORE_URL,
        downloadUrl: APP_STORE_URL,
        operatingSystem: "iOS",
        applicationCategory: "LifestyleApplication",
        inLanguage: "fr",
        image: `${SITE_URL}/icons/icon-512.png`,
        screenshot: Object.values(SCREENS).map((s) => `${SITE_URL}${s.image.src}`),
        publisher: { "@id": ORGANIZATION_ID },
        offers: [
          {
            "@type": "Offer",
            name: "Gratuit (1 cheval)",
            price: "0",
            priceCurrency: "EUR",
          },
          {
            "@type": "Offer",
            name: "Horsetrack Premium — mensuel",
            price: PRICING.monthlyValue.toFixed(2),
            priceCurrency: "EUR",
          },
          {
            "@type": "Offer",
            name: "Horsetrack Premium — annuel",
            price: PRICING.yearlyValue.toFixed(2),
            priceCurrency: "EUR",
          },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        inLanguage: "fr-FR",
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };
}
