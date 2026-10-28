import type { CSSProperties } from "react";
import { Icon } from "@/components/Icon";
import { LESS_ADMIN } from "@/content/home";
import styles from "./LessAdmin.module.css";

export function LessAdmin() {
  return (
    <section id="moins-d-admin" className={styles.section} aria-labelledby="less-admin-title">
      <div className="container">
        <div className={styles.panel}>
          <Icon name="horseshoe" className={styles.deco} strokeWidth={0.6} />
          <header className={styles.head} data-reveal>
            <p className="sticker sticker--sky">Moins d&apos;admin</p>
            <h2 id="less-admin-title" className="h2">
              Moins d&apos;admin, <span className={styles.accent}>plus de cheval.</span>
            </h2>
            <p className={styles.lead}>
              Horsetrack s&apos;occupe de la mémoire : les rendez-vous, les papiers, les dépenses, les consignes. Vous
              gardez le temps pour l&apos;essentiel, être à cheval.
            </p>
          </header>

          <ul role="list" className={styles.grid}>
            {LESS_ADMIN.map((item, i) => (
              <li key={item.before} data-reveal style={{ "--reveal-delay": `${(i % 3) * 90}ms` } as CSSProperties}>
                <article className={styles.card}>
                  <div className={styles.cardTop}>
                    <span className={styles.icon}>
                      <Icon name={item.icon} size={22} />
                    </span>
                    {item.premium && <span className={styles.premium}>Premium</span>}
                  </div>
                  <h3 className={styles.before}>
                    <span className="sr-only">Avant : </span>
                    {item.before}
                  </h3>
                  <p className={styles.after}>
                    <Icon name="arrowRight" size={18} strokeWidth={2.2} className={styles.arrow} />
                    <span>
                      <span className="sr-only">Avec Horsetrack : </span>
                      {item.after}
                    </span>
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
