import { APP_STORE_URL, NAV } from "@/content/site";
import { Icon } from "./Icon";
import { Logo } from "./Logo";
import styles from "./Header.module.css";

export function Header() {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Logo />
        <nav aria-label="Navigation principale" className={styles.nav}>
          <ul role="list">
            {NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <a href={APP_STORE_URL} className={`btn btn--primary ${styles.cta}`} rel="noopener">
          Télécharger
          <Icon name="arrowDown" size={16} strokeWidth={2.2} />
        </a>
      </div>
    </header>
  );
}
