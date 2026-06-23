import type { ReactNode } from "react";

/** Conteneur partagé par les pages légales publiques (/cgu, /confidentialite),
 * liées depuis le paywall mobile (cf. PaywallView.tsx). */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 80px", lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>{title}</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginTop: 0 }}>Dernière mise à jour : {updated}</p>
      {children}
    </main>
  );
}
