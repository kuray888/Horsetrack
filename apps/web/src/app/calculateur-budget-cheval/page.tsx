import Link from "next/link";
import type { Metadata } from "next";
import { BudgetCalculator } from "@/components/BudgetCalculator";
import { GuideCard } from "@/components/GuideCard";
import styles from "@/components/Article.module.css";
import { guideBySlug } from "@/content/guides";

export const metadata: Metadata = {
  title: { absolute: "Calculateur de budget cheval : combien coûte votre cheval ? · Horsetrack" },
  description:
    "Pension, maréchal, vétérinaire, alimentation, assurance : calculez gratuitement ce que votre cheval vous coûte par mois et par an.",
  alternates: { canonical: "/calculateur-budget-cheval" },
};

export default function CalculatorPage() {
  const related = ["cout-cheval-par-mois", "organiser-demi-pension", "marechal-ferrant-frequence"]
    .map(guideBySlug)
    .filter((g) => g !== undefined);
  return (
    <div className={styles.page}>
      <div className="container">
        <nav aria-label="Fil d'Ariane" className={styles.crumbs}>
          <Link href="/">Accueil</Link>
          <span aria-hidden="true">›</span>
          <Link href="/guides">Guides</Link>
        </nav>
        <h1 className={styles.title}>Combien coûte votre cheval ?</h1>
        <p className={`lead ${styles.intro}`}>
          Renseignez vos dépenses : le total mensuel et annuel se calcule tout seul, poste par poste. Rien n&apos;est
          enregistré ni envoyé.
        </p>
        <BudgetCalculator />
        <div className={styles.related}>
          <h2>Pour aller plus loin</h2>
          <div className={styles.cards}>
            {related.map((g) => (
              <GuideCard key={g.slug} guide={g} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
