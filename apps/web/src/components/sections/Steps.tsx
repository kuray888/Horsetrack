import type { CSSProperties } from "react";
import { AppStoreBadge } from "@/components/AppStoreBadge";
import { STEPS } from "@/content/home";
import styles from "./Steps.module.css";

export function Steps() {
  return (
    <section id="comment-ca-marche" className="section" aria-labelledby="steps-title">
      <div className="container">
        <header className="section-head" data-reveal>
          <p className="sticker sticker--copper">Comment ça marche</p>
          <h2 id="steps-title" className="h2">
            Prêt en <span className="accent">trois étapes.</span>
          </h2>
          <p className="lead">Pas de formation, pas de tableur à remplir : quelques minutes suffisent pour démarrer.</p>
        </header>

        <ol role="list" className={styles.steps}>
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className={styles.step}
              data-reveal
              style={{ "--reveal-delay": `${i * 120}ms` } as CSSProperties}
            >
              <span className={styles.number} aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3>
                <span className="sr-only">Étape {i + 1} : </span>
                {step.title}
              </h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>

        <div className={styles.cta} data-reveal>
          <AppStoreBadge />
          <p>Gratuit · Pour iPhone</p>
        </div>
      </div>
    </section>
  );
}
