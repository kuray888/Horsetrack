import { AppStoreBadge } from "@/components/AppStoreBadge";
import { Screen } from "@/components/Screen";
import styles from "./FinalCta.module.css";

export function FinalCta() {
  return (
    <section id="cta-final" className={styles.section} aria-labelledby="final-title">
      <div className="container">
        <div className={styles.card}>
          <div className={styles.copy} data-reveal>
            <h2 id="final-title" className="h2">
              Votre cheval mérite mieux qu&apos;un carnet oublié à l&apos;écurie.
            </h2>
            <p>
              Rejoignez Horsetrack : planning, soins, concours, journal et budget, au même endroit. Gratuit pour
              commencer.
            </p>
            <AppStoreBadge size="lg" />
          </div>
          <div className={styles.visual} data-reveal="zoom" aria-hidden="true">
            <Screen name="journal" decorative sizes="(min-width: 900px) 300px, 60vw" />
          </div>
        </div>
      </div>
    </section>
  );
}
