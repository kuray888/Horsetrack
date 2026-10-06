import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { APP_STORE_ID, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/content/site";
import "./globals.css";

/** Police des titres de l'app (cf. apps/mobile/tailwind.config.js), téléchargée
 * au build et servie depuis notre domaine : aucune requête vers Google. */
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
  variable: "--font-bricolage",
});

const TITLE = "Horsetrack — L'app de suivi de votre cheval : soins, planning, concours";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · Horsetrack" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "application équitation",
    "suivi cheval",
    "carnet de santé cheval",
    "planning cavalier",
    "rappel vermifuge",
    "maréchal-ferrant",
    "concours équestre",
    "demi-pension",
    "budget cheval",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "lifestyle",
  alternates: { canonical: "/" },
  formatDetection: { telephone: false, address: false, email: false },
  // Bannière « Ouvrir dans l'App Store » de Safari sur iPhone.
  itunes: { appId: APP_STORE_ID },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName: SITE_NAME,
    title: TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export const viewport: Viewport = {
  themeColor: "#f9f7f2",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={bricolage.variable}>
      <body>
        <a href="#contenu" className="skip-link">
          Aller au contenu
        </a>
        <Header />
        <main id="contenu" tabIndex={-1}>
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
