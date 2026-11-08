import Link from "next/link";
import type { Guide } from "@/content/guides";
import styles from "./Article.module.css";

export function GuideCard({ guide }: { guide: Pick<Guide, "slug" | "title" | "description"> }) {
  return (
    <Link href={`/guides/${guide.slug}`} className={styles.card}>
      <h3>{guide.title}</h3>
      <p>{guide.description}</p>
      <span>Lire le guide →</span>
    </Link>
  );
}

/** Carte du calculateur, mise en avant parmi les guides. */
export function CalculatorCard() {
  return (
    <Link href="/calculateur-budget-cheval" className={`${styles.card} ${styles.cardFeatured}`}>
      <h3>Calculateur de budget cheval</h3>
      <p>Pension, maréchal, véto, assurance : estimez ce que votre cheval vous coûte par mois et par an.</p>
      <span>Calculer mon budget →</span>
    </Link>
  );
}
