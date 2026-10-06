import type { CSSProperties } from "react";
import { AppStoreBadge } from "@/components/AppStoreBadge";
import { Icon, type IconName } from "@/components/Icon";
import { PLANS } from "@/content/home";
import { PRICING } from "@/content/site";
import styles from "./Pricing.module.css";

const TRUST: { icon: IconName; text: string }[] = [
  { icon: "ban", text: "Aucune publicité, aucun traceur publicitaire" },
  { icon: "shield", text: "Verrouillage Face ID de l'app" },
  { icon: "trash", text: "Compte supprimable à tout moment depuis l'app" },
];

export function Pricing() {
  const { free, premium } = PLANS;
  return (
    <section id="tarifs" className={`section ${styles.section}`} aria-labelledby="pricing-title">
      <div className="container">
        <header className="section-head" data-reveal>
          <p className="sticker sticker--blue">Tarifs</p>
          <h2 id="pricing-title" className="h2">
            Gratuit <span className="accent">pour commencer.</span>
          </h2>
          <p className="lead">
            Suivez un cheval gratuitement, sans limite de durée. Passez à Premium quand vous voulez, avec{" "}
            {PRICING.trial} d&apos;essai offert.
          </p>
        </header>

        <div className={styles.plans}>
          <article className={styles.plan} data-reveal aria-labelledby="plan-free">
            <h3 id="plan-free" className={styles.name}>
              {free.name}
            </h3>
            <p className={styles.audience}>{free.audience}</p>
            <p className={styles.price}>
              <strong>{free.price}</strong> <span>{free.period}</span>
            </p>
            <ul role="list" className={styles.items}>
              {free.items.map((item) => (
                <li key={item}>
                  <Icon name="check" size={18} strokeWidth={2.4} />
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article
            className={`${styles.plan} ${styles.premium}`}
            data-reveal
            style={{ "--reveal-delay": "120ms" } as CSSProperties}
            aria-labelledby="plan-premium"
          >
            <p className={`sticker sticker--copper ${styles.badge}`}>{premium.badge}</p>
            <h3 id="plan-premium" className={styles.name}>
              {premium.name}
            </h3>
            <p className={styles.audience}>{premium.audience}</p>
            <p className={styles.price}>
              <strong>{premium.price}</strong> <span>{premium.period}</span>
            </p>
            <p className={styles.alt}>{premium.alt}</p>
            <ul role="list" className={styles.items}>
              <li className={styles.plus}>Tout le gratuit, et en plus :</li>
              {premium.items.map((item) => (
                <li key={item}>
                  <Icon name="check" size={18} strokeWidth={2.4} />
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>

        <div className={styles.footer} data-reveal>
          <AppStoreBadge />
          <p className={styles.note}>
            Prix TTC pour la France. Sans engagement : l&apos;abonnement se gère et s&apos;annule dans les réglages
            de votre compte Apple. Le prix applicable est affiché dans l&apos;app avant tout achat.
          </p>
        </div>

        <ul role="list" className={styles.trust} data-reveal>
          {TRUST.map((item) => (
            <li key={item.text}>
              <Icon name={item.icon} size={20} />
              {item.text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
