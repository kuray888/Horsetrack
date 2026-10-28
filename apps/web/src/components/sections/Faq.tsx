import { Icon } from "@/components/Icon";
import { FAQ } from "@/content/home";
import { CONTACT_EMAIL, LINKS } from "@/content/site";
import styles from "./Faq.module.css";

/** Accordéon natif <details> : accessible au clavier et aux lecteurs d'écran
 * sans JavaScript. */
export function Faq() {
  return (
    <section id="faq" className="section" aria-labelledby="faq-title">
      <div className={`container ${styles.grid}`}>
        <header className={styles.head} data-reveal>
          <p className="sticker sticker--sky">FAQ</p>
          <h2 id="faq-title" className="h2">
            Vos questions, <span className="accent">nos réponses.</span>
          </h2>
          <div className={styles.contact}>
            <span className={styles.contactIcon}>
              <Icon name="mail" size={22} />
            </span>
            <div>
              <p className={styles.contactTitle}>Une autre question ?</p>
              <p>
                Écrivez-nous à <a href={LINKS.email}>{CONTACT_EMAIL}</a>, nous répondons sous quelques jours ouvrés.
              </p>
            </div>
          </div>
        </header>

        <div className={styles.list} data-reveal>
          {FAQ.map((item, i) => (
            <details key={item.q} className={styles.item} name="faq" open={i === 0}>
              <summary>
                <h3>{item.q}</h3>
                <span className={styles.toggle} aria-hidden="true">
                  <Icon name="plus" size={18} strokeWidth={2.2} />
                </span>
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
