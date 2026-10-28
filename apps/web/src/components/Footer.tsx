import { APP_STORE_URL, CONTACT_EMAIL, LINKS, NAV, SITE_TAGLINE } from "@/content/site";
import { AppStoreBadge } from "./AppStoreBadge";
import { Logo } from "./Logo";
import styles from "./Footer.module.css";

/** Liens vers les pages de l'app hébergées par l'API : ouverts dans un nouvel
 * onglet, sans transmettre l'onglet d'origine (noopener) ni l'adresse de la
 * page (noreferrer). */
const external = { target: "_blank", rel: "noopener noreferrer" } as const;

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer} id="pied-de-page">
      <div className={`container ${styles.top}`}>
        <div className={styles.brand}>
          <Logo tone="light" />
          <p>{SITE_TAGLINE}</p>
          <AppStoreBadge />
        </div>

        <nav aria-label="Application" className={styles.col}>
          <h2>Application</h2>
          <ul role="list">
            {NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
            <li>
              <a href={APP_STORE_URL} rel="noopener">
                Télécharger sur l&apos;App Store
              </a>
            </li>
          </ul>
        </nav>

        <nav aria-label="Informations légales" className={styles.col}>
          <h2>Légal</h2>
          <ul role="list">
            <li>
              <a href={LINKS.legalNotice}>Mentions légales</a>
            </li>
            <li>
              <a href={LINKS.privacy} {...external}>
                Confidentialité<span className="sr-only"> (nouvel onglet)</span>
              </a>
            </li>
            <li>
              <a href={LINKS.terms} {...external}>
                Conditions d&apos;utilisation<span className="sr-only"> (nouvel onglet)</span>
              </a>
            </li>
            <li>
              <a href={LINKS.accountDeletion} {...external}>
                Supprimer son compte<span className="sr-only"> (nouvel onglet)</span>
              </a>
            </li>
          </ul>
        </nav>

        <div className={`${styles.col} ${styles.contact}`}>
          <h2>Contact</h2>
          <ul role="list">
            <li>
              <a href={LINKS.email}>{CONTACT_EMAIL}</a>
            </li>
            <li>
              <a href={LINKS.support} {...external}>
                Aide et support<span className="sr-only"> (nouvel onglet)</span>
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="container">
        <div className={styles.bottom}>
          <p>© {year} Horsetrack. Tous droits réservés.</p>
          <p>Apple, le logo Apple, iPhone et App Store sont des marques d&apos;Apple Inc.</p>
        </div>
      </div>
    </footer>
  );
}
