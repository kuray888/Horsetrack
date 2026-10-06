import type { Metadata } from "next";
import Link from "next/link";
import { AppStoreBadge } from "@/components/AppStoreBadge";
import { Icon } from "@/components/Icon";
import styles from "./not-found.module.css";

export const metadata: Metadata = {
  title: "Page introuvable",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <section className={`container ${styles.page}`} aria-labelledby="not-found-title">
      <Icon name="horseshoe" size={72} strokeWidth={1.2} className={styles.icon} />
      <p className="sticker sticker--copper">Erreur 404</p>
      <h1 id="not-found-title" className="h2">
        Cette page s&apos;est <span className="accent">échappée du paddock.</span>
      </h1>
      <p className="lead">L&apos;adresse est peut-être mal saisie, ou la page a changé de box.</p>
      <div className={styles.actions}>
        <Link href="/" className="btn btn--primary">
          Retour à l&apos;accueil
        </Link>
        <AppStoreBadge />
      </div>
    </section>
  );
}
