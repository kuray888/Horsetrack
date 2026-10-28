import { AppStoreBadge } from "@/components/AppStoreBadge";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { MARQUEE } from "@/content/home";
import { PRICING } from "@/content/site";
import styles from "./Hero.module.css";

export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={`container ${styles.grid}`}>
        <div className={styles.copy}>
          <p className={`sticker sticker--copper ${styles.kicker}`}>Application iPhone · Suivi équestre</p>
          <h1 id="hero-title" className={`display ${styles.title}`}>
            <span>Toute votre vie</span> <span>équestre.</span> <span className="accent">Au même endroit.</span>
          </h1>
          <p className={`lead ${styles.lead}`}>
            Séances, soins, concours, journal et budget : Horsetrack réunit le suivi de vos chevaux dans une seule app.
            Fini les ordonnances perdues, le vermifuge oublié ou le carnet resté à l&apos;écurie.
          </p>
          <div className={styles.actions}>
            <AppStoreBadge id="hero-cta" size="lg" />
            <a href="#fonctionnalites" className="btn btn--ghost">
              Découvrir l&apos;app
              <Icon name="arrowDown" size={18} />
            </a>
          </div>
          <ul role="list" className={styles.proof}>
            <li>
              <Icon name="check" size={18} strokeWidth={2.4} />
              Gratuit pour 1 cheval
            </li>
            <li>
              <Icon name="check" size={18} strokeWidth={2.4} />
              {PRICING.trial} d&apos;essai Premium
            </li>
            <li>
              <Icon name="check" size={18} strokeWidth={2.4} />
              Sans publicité
            </li>
          </ul>
        </div>

        <div className={styles.visual}>
          <div className={styles.halo} aria-hidden="true">
            <span className={styles.ring} />
          </div>
          <div className={`${styles.phone} ${styles.left}`}>
            <div className={styles.float}>
              <Screen name="ficheCheval" decorative sizes="(min-width: 960px) 240px, 34vw" />
            </div>
          </div>
          <div className={`${styles.phone} ${styles.right}`}>
            <div className={styles.float}>
              <Screen name="planningConcours" decorative sizes="(min-width: 960px) 250px, 34vw" />
            </div>
          </div>
          <div className={`${styles.phone} ${styles.main}`}>
            <div className={styles.float}>
              <Screen name="accueil" priority sizes="(min-width: 960px) 320px, 62vw" />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.band} aria-hidden="true">
        <div className={styles.marquee}>
          {[0, 1].map((copy) => (
            <ul key={copy} className={styles.track}>
              {MARQUEE.map((item) => (
                <li key={item}>
                  {item}
                  <Icon name="horseshoe" size={22} strokeWidth={1.6} />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
