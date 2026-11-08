import Link from "next/link";
import { CalculatorCard, GuideCard } from "@/components/GuideCard";
import styles from "@/components/Article.module.css";
import { GUIDES } from "@/content/guides";

/** Guides et calculateur depuis l'accueil : utile aux visiteurs qui
 * hésitent, et liens internes pour que les moteurs de recherche les trouvent. */
export function GuidesTeaser() {
  return (
    <section className="section" aria-labelledby="guides-title">
      <div className="container">
        <div className="section-head" data-reveal>
          <h2 id="guides-title" className="h2">
            Guides et outils <span className="accent">gratuits</span>
          </h2>
          <p className="lead">Budget, santé, demi-pension : les réponses aux questions de tous les cavaliers.</p>
        </div>
        <div className={styles.cards}>
          <CalculatorCard />
          {GUIDES.slice(0, 5).map((g) => (
            <GuideCard key={g.slug} guide={g} />
          ))}
        </div>
        <p style={{ marginTop: 24, textAlign: "center" }}>
          <Link href="/guides" className="btn btn--ghost">
            Tous les guides
          </Link>
        </p>
      </div>
    </section>
  );
}
