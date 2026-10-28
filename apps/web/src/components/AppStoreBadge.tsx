import Image from "next/image";
import { APP_STORE_URL } from "@/content/site";
import styles from "./AppStoreBadge.module.css";

/** Badge officiel Apple « Télécharger dans l'App Store » (artwork fourni par
 * Apple, non modifié — cf. guide marketing App Store : hauteur ≥ 40 px). Le
 * lien s'ouvre dans l'onglet courant : sur iPhone, il bascule directement
 * vers l'app App Store. */
export function AppStoreBadge({ id, size = "md", className }: { id?: string; size?: "md" | "lg"; className?: string }) {
  return (
    <a id={id} href={APP_STORE_URL} className={`${styles.badge} ${styles[size]} ${className ?? ""}`} rel="noopener">
      <Image
        src="/brand/app-store-badge-fr-black.svg"
        alt="Télécharger dans l'App Store"
        width={127}
        height={40}
        unoptimized
        priority={size === "lg"}
      />
    </a>
  );
}
