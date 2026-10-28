import type { CSSProperties } from "react";
import { Icon } from "@/components/Icon";
import { FEATURES } from "@/content/home";
import styles from "./Features.module.css";

export function Features() {
  return (
    <section id="fonctionnalites" className="section" aria-labelledby="features-title">
      <div className="container">
        <header className="section-head" data-reveal>
          <p className="sticker sticker--blue">Fonctionnalités</p>
          <h2 id="features-title" className="h2">
            Tout le suivi de votre cheval, <span className="accent">dans votre poche.</span>
          </h2>
          <p className="lead">
            Horsetrack remplace le carnet, les post-it et le tableur : tout ce qui compte pour votre cheval, réuni et
            toujours à jour.
          </p>
        </header>

        <ul role="list" className={styles.grid}>
          {FEATURES.map((feature, i) => (
            <li key={feature.title} data-reveal style={{ "--reveal-delay": `${(i % 4) * 70}ms` } as CSSProperties}>
              <article className={styles.card}>
                <span className={styles.icon}>
                  <Icon name={feature.icon} size={24} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
