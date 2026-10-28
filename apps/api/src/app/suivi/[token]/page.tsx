import type { Metadata } from "next";
import { db } from "@cheval/db";
import { isShareToken, isViewable, mapsLinks, minutesAgo, parisTime } from "@/lib/rideSafety";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Suivi de balade · Horsetrack",
  robots: { index: false, follow: false },
};

const STYLE = `
  :root { --bg: #f6f4f0; --card: #ffffff; --text: #1f2933; --muted: #6b7280; --border: #e5e7eb;
    --ok: #2f7d4f; --alert: #b42318; --primary: #274c77; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #111418; --card: #1b2026; --text: #eef1f4; --muted: #9aa3ad; --border: #2b323a;
      --ok: #5cc28a; --alert: #ff6b5e; --primary: #8fb8e8; }
  }
  body { background: var(--bg) !important; color: var(--text) !important; }
  .wrap { max-width: 640px; margin: 0 auto; padding: 24px 16px 48px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 20px; margin-top: 16px; }
  .badge { display: inline-block; font-weight: 600; font-size: 13px; padding: 4px 10px; border-radius: 999px; }
  .ok { background: color-mix(in srgb, var(--ok) 15%, transparent); color: var(--ok); }
  .alert { background: color-mix(in srgb, var(--alert) 15%, transparent); color: var(--alert); }
  .ended { background: var(--border); color: var(--muted); }
  h1 { font-size: 22px; margin: 8px 0 4px; }
  .muted { color: var(--muted); font-size: 14px; }
  iframe { width: 100%; height: 320px; border: 0; border-radius: 12px; margin-top: 12px; }
  .links { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 12px; }
  .links a { flex: 1; min-width: 140px; text-align: center; padding: 12px; border-radius: 12px;
    border: 1px solid var(--border); color: var(--primary); text-decoration: none; font-weight: 600; }
`;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="wrap">
      {/* Rafraîchie toutes les 30 s, sans script (React place la balise dans <head>). */}
      <meta httpEquiv="refresh" content="30" />
      <style>{STYLE}</style>
      <div className="muted">Horsetrack · Sécurité en balade</div>
      {children}
    </main>
  );
}

/**
 * Lien de suivi envoyé aux proches (cf. lib/rideSafety.ts) : dernière
 * position du cavalier, statut, liens vers Plans et Google Maps. Public mais
 * non devinable (jeton de 24 octets), non indexé, et illisible 24 h après la
 * fin de la balade.
 */
export default async function RideTrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const now = new Date();
  const share = isShareToken(token) ? await db.rideShare.findUnique({ where: { id: token } }) : null;

  if (!share || !isViewable(share, now)) {
    return (
      <Shell>
        <div className="card">
          <h1>Suivi terminé</h1>
          <p className="muted">Ce lien de suivi a expiré ou n&apos;existe pas.</p>
        </div>
      </Shell>
    );
  }

  const status =
    share.status === "ENDED"
      ? { label: "Séance terminée", className: "ended" }
      : share.status === "ALERT"
        ? { label: "Alerte envoyée", className: "alert" }
        : { label: "En selle", className: "ok" };
  const hasPosition = share.lastLat !== null && share.lastLng !== null;
  const lastAt = share.lastPointAt;
  const silent = share.status !== "ENDED" && (!lastAt || now.getTime() - lastAt.getTime() > 5 * 60_000);

  let map: React.ReactNode = null;
  if (hasPosition) {
    const lat = share.lastLat!;
    const lng = share.lastLng!;
    const d = 0.006;
    const bbox = [lng - d, lat - d / 1.6, lng + d, lat + d / 1.6].map((n) => n.toFixed(5)).join(",");
    const links = mapsLinks(lat, lng);
    map = (
      <>
        <iframe
          title="Dernière position"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)},${lng.toFixed(5)}`}
          loading="lazy"
        />
        <div className="links">
          <a href={links.apple}>Ouvrir dans Plans</a>
          <a href={links.google}>Ouvrir dans Google Maps</a>
        </div>
      </>
    );
  }

  return (
    <Shell>
      <div className="card">
        <span className={`badge ${status.className}`}>{status.label}</span>
        <h1>
          {share.riderName} · avec {share.horseName}
        </h1>
        <p className="muted">Départ à {parisTime(share.startedAt)}</p>
        {share.status !== "ENDED" ? (
          <p>
            {lastAt
              ? `Dernière position reçue ${minutesAgo(lastAt, now)} (${parisTime(lastAt)}).`
              : "En attente de la première position."}
            {silent ? " Le téléphone ne donne plus de nouvelles : essayez d'appeler." : ""}
          </p>
        ) : (
          <p>La séance est terminée{share.endedAt ? ` depuis ${parisTime(share.endedAt)}` : ""}.</p>
        )}
        {share.status !== "ENDED" ? map : null}
      </div>
      {share.status === "ALERT" ? (
        <div className="card">
          <strong>Que faire ?</strong>
          <p className="muted">
            Appelez d&apos;abord le cavalier. Sans réponse, rendez-vous à la dernière position ou appelez les secours
            (112).
          </p>
        </div>
      ) : null}
      <p className="muted" style={{ marginTop: 16 }}>
        Page actualisée toutes les 30 secondes.
      </p>
    </Shell>
  );
}
