import type { ReactNode } from "react";

export const metadata = {
  title: "Horsetrack",
};

/** Layout racine — ne sert que les pages publiques (CGU, confidentialité) ;
 * les routes /api/* n'en dépendent pas. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", color: "#1f2933", background: "#fafafa" }}>
        <style>{`
          h2 { font-size: 18px; margin-top: 32px; margin-bottom: 8px; }
          p, li { font-size: 15px; }
          ul { padding-left: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 14px; }
          th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; vertical-align: top; }
          a { color: #274c77; }
        `}</style>
        {children}
      </body>
    </html>
  );
}
