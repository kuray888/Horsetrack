import type { Metadata } from "next";
import { GestionApp } from "@/components/gestion/GestionApp";
import styles from "@/components/gestion/Gestion.module.css";

// Page privée : jamais indexée, jamais dans le plan du site.
export const metadata: Metadata = {
  title: "Espace gestionnaire",
  description: "Le planning de votre écurie sur grand écran, avec Écurie Pro.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/gestion" },
};

export default function GestionPage() {
  return (
    <main id="contenu" className={`container ${styles.shell}`}>
      <GestionApp />
    </main>
  );
}
