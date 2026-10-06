"use client";

import { useEffect, useState } from "react";
import styles from "./StickyCta.module.css";

/**
 * Barre « Télécharger » collée en bas de l'écran sur mobile : elle apparaît
 * une fois le bouton App Store du haut de page dépassé, et s'efface quand le
 * dernier appel à l'action ou le pied de page arrive (pas de doublon à
 * l'écran). Masquée sur grand écran (cf. CSS), où l'en-tête garde son bouton.
 *
 * Le lien arrive en prop : la configuration du site (content/site.ts) reste
 * côté serveur, hors du JavaScript envoyé au navigateur.
 */
export function StickyCta({ href, startId, endIds }: { href: string; startId: string; endIds: string[] }) {
  const [visible, setVisible] = useState(false);
  const endKey = endIds.join(" ");

  useEffect(() => {
    const start = document.getElementById(startId);
    if (!start || !("IntersectionObserver" in window)) return;
    const ends = endKey.split(" ").map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);

    let startPassed = false;
    const endsInView = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === start) {
          startPassed = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        } else if (entry.isIntersecting) {
          endsInView.add(entry.target);
        } else {
          endsInView.delete(entry.target);
        }
      }
      setVisible(startPassed && endsInView.size === 0);
    });
    observer.observe(start);
    ends.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [startId, endKey]);

  return (
    <div className={styles.bar} data-visible={visible} aria-hidden={!visible} inert={!visible}>
      <div className={styles.inner}>
        <span className={styles.icon} aria-hidden="true" />
        <span className={styles.text}>
          <strong>Horsetrack</strong>
          <span>Gratuit sur l&apos;App Store</span>
        </span>
        <a href={href} className={styles.button} rel="noopener">
          Télécharger
        </a>
      </div>
    </div>
  );
}
