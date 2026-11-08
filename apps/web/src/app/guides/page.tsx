import type { Metadata } from "next";
import { CalculatorCard, GuideCard } from "@/components/GuideCard";
import styles from "@/components/Article.module.css";
import { GUIDES } from "@/content/guides";

export const metadata: Metadata = {
  title: "Guides pratiques du cavalier",
  description:
    "Carnet de santé, budget, vermifuge, demi-pension, planning, maréchal : des guides clairs pour mieux suivre votre cheval au quotidien.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.narrow}>
          <h1 className={styles.title}>Guides pratiques du cavalier</h1>
          <p className={`lead ${styles.intro}`}>
            Les questions que se posent tous les propriétaires et cavaliers, avec des réponses claires et une méthode
            pour ne plus rien oublier.
          </p>
        </div>
        <div className={styles.related}>
          <div className={styles.cards}>
            <CalculatorCard />
            {GUIDES.map((g) => (
              <GuideCard key={g.slug} guide={g} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
