import { JsonLd } from "@/components/JsonLd";
import { RevealObserver } from "@/components/RevealObserver";
import { StickyCta } from "@/components/StickyCta";
import { Faq } from "@/components/sections/Faq";
import { Features } from "@/components/sections/Features";
import { FinalCta } from "@/components/sections/FinalCta";
import { Hero } from "@/components/sections/Hero";
import { LessAdmin } from "@/components/sections/LessAdmin";
import { Pricing } from "@/components/sections/Pricing";
import { Steps } from "@/components/sections/Steps";
import { Stories } from "@/components/sections/Stories";
import { APP_STORE_URL } from "@/content/site";
import { homeStructuredData } from "@/lib/structuredData";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <Stories />
      <LessAdmin />
      <Steps />
      <Pricing />
      <Faq />
      <FinalCta />
      <StickyCta href={APP_STORE_URL} startId="hero-cta" endIds={["cta-final", "pied-de-page"]} />
      <RevealObserver />
      <JsonLd data={homeStructuredData()} />
    </>
  );
}
