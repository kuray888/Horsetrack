import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppStoreBadge } from "@/components/AppStoreBadge";
import { CalculatorCard, GuideCard } from "@/components/GuideCard";
import { JsonLd } from "@/components/JsonLd";
import styles from "@/components/Article.module.css";
import { GUIDES, guideBySlug } from "@/content/guides";
import { guideStructuredData } from "@/lib/structuredData";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = guideBySlug((await params).slug);
  if (!guide) return {};
  return {
    title: { absolute: `${guide.seoTitle} · Horsetrack` },
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: { type: "article", title: guide.seoTitle, description: guide.description, url: `/guides/${guide.slug}` },
  };
}

const dateFr = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default async function GuidePage({ params }: Props) {
  const guide = guideBySlug((await params).slug);
  if (!guide) notFound();
  const related = guide.related.map(guideBySlug).filter((g) => g !== undefined);

  return (
    <div className={styles.page}>
      <article className="container">
        <div className={styles.narrow}>
          <nav aria-label="Fil d'Ariane" className={styles.crumbs}>
            <Link href="/">Accueil</Link>
            <span aria-hidden="true">›</span>
            <Link href="/guides">Guides</Link>
          </nav>
          <h1 className={styles.title}>{guide.title}</h1>
          <p className={styles.meta}>
            Mis à jour le {dateFr(guide.updated)} · {guide.readingMinutes} min de lecture
          </p>
          <p className={`lead ${styles.intro}`}>{guide.description}</p>

          <div className={styles.body}>
            {guide.sections.map((section) => (
              <section key={section.heading}>
                <h2>{section.heading}</h2>
                {section.blocks.map((block, i) =>
                  block.type === "p" ? (
                    <p key={i}>{block.text}</p>
                  ) : block.type === "list" ? (
                    <ul key={i}>
                      {block.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p key={i} className={styles.tip}>
                      <strong>Conseil : </strong>
                      {block.text}
                    </p>
                  )
                )}
              </section>
            ))}
          </div>

          <aside className={styles.cta} aria-label="Horsetrack">
            <h2>Et au quotidien ?</h2>
            <p>{guide.appPitch} Gratuit pour un cheval.</p>
            <AppStoreBadge size="lg" />
          </aside>
        </div>

        <div className={styles.related}>
          <h2>À lire aussi</h2>
          <div className={styles.cards}>
            {related.map((g) => (
              <GuideCard key={g.slug} guide={g} />
            ))}
            <CalculatorCard />
          </div>
        </div>
      </article>
      <JsonLd data={guideStructuredData(guide)} />
    </div>
  );
}
