import Link from "next/link";
import styles from "./Logo.module.css";

/** Logo « h. » + « HORSETRACK », comme sur les visuels App Store. Le « h. »
 * est un masque CSS teint par `color` (marine dans l'en-tête, blanc dans le
 * pied de page) — une seule image pour les deux. */
export function Logo({ tone = "ink" }: { tone?: "ink" | "light" }) {
  return (
    <Link href="/" className={`${styles.logo} ${tone === "light" ? styles.light : ""}`} aria-label="Horsetrack, accueil">
      <span className={styles.mark} aria-hidden="true" />
      <span className={styles.word} aria-hidden="true">
        Horsetrack
      </span>
    </Link>
  );
}
