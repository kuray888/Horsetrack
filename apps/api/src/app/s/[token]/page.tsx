import type { Metadata } from "next";
import { db } from "@cheval/db";
import { isShareToken } from "@/lib/rideSafety";
import { formatDistance, formatDuration, gaitShares, routeToSvgPoints } from "@/lib/publicRide";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Une balade à cheval · Horsetrack",
  robots: { index: false, follow: false },
};

const STYLE = `
  :root { --bg: #f6f4f0; --card: #ffffff; --text: #1f2933; --muted: #6b7280; --border: #e5e7eb; --primary: #274c77; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #111418; --card: #1b2026; --text: #eef1f4; --muted: #9aa3ad; --border: #2b323a; --primary: #8fb8e8; }
  }
  body { background: var(--bg) !important; color: var(--text) !important; }
  .wrap { max-width: 560px; margin: 0 auto; padding: 24px 16px 48px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 20px; margin-top: 16px; }
  h1 { font-size: 22px; margin: 4px 0; }
  .muted { color: var(--muted); font-size: 14px; }
  .stats { display: flex; gap: 24px; flex-wrap: wrap; margin-top: 12px; }
  .stat b { display: block; font-size: 26px; }
  .stat span { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  svg { width: 100%; height: auto; margin-top: 12px; border-radius: 12px; background: color-mix(in srgb, var(--primary) 8%, transparent); }
  .cta { display: block; text-align: center; padding: 14px; border-radius: 12px; background: var(--primary); color: #fff;
    font-weight: 700; text-decoration: none; margin-top: 12px; }
`;

const W = 520;
const H = 320;

/**
 * Page publique d'une séance partagée par son cavalier (cf. lib/publicRide.ts) :
 * forme du parcours, durée, distance, allures. Aucun fond de carte ni tiers, aucun
 * nom de cavalier, non indexée ; elle disparaît quand le cavalier supprime son lien.
 */
export default async function PublicRidePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ride = isShareToken(token) ? await db.publicRide.findUnique({ where: { id: token } }) : null;

  if (!ride) {
    return (
      <main className="wrap">
        <style>{STYLE}</style>
        <div className="muted">Horsetrack</div>
        <div className="card">
          <h1>Ce lien n&apos;existe plus</h1>
          <p className="muted">Le cavalier a supprimé sa balade, ou l&apos;adresse est incorrecte.</p>
          <a className="cta" href="https://horsetrack.fr">Découvrir Horsetrack</a>
        </div>
      </main>
    );
  }

  const points = routeToSvgPoints(ride.route, W, H);
  const gaits = gaitShares(ride);
  const [sx, sy] = points ? points.split(" ")[0].split(",") : [];
  const [ex, ey] = points ? points.split(" ").slice(-1)[0].split(",") : [];

  return (
    <main className="wrap">
      <style>{STYLE}</style>
      <div className="muted">Horsetrack · Une balade partagée</div>
      <div className="card">
        <h1>{ride.horseName ? `${ride.activity || "Séance"} avec ${ride.horseName}` : ride.activity || "Séance à cheval"}</h1>
        <p className="muted">
          {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(ride.startedAt)}
        </p>
        <div className="stats">
          <div className="stat"><b>{formatDuration(ride.durationSeconds)}</b><span>Durée</span></div>
          {ride.distanceMeters > 0 ? <div className="stat"><b>{formatDistance(ride.distanceMeters)}</b><span>Distance</span></div> : null}
          {ride.avgSpeedKmh > 0 ? <div className="stat"><b>{ride.avgSpeedKmh.toFixed(1).replace(".", ",")} km/h</b><span>Vitesse moy.</span></div> : null}
        </div>
        {points ? (
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tracé du parcours">
            <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={sx} cy={sy} r="7" fill="#2f7d4f" />
            <circle cx={ex} cy={ey} r="8" fill="var(--primary)" />
          </svg>
        ) : null}
        {ride.endsHidden && points ? <p className="muted">Le départ et l&apos;arrivée sont masqués (200 m).</p> : null}
        {gaits.length > 0 ? <p className="muted">{gaits.map((g) => `${g.label} ${g.pct} %`).join(" · ")} (allures estimées)</p> : null}
      </div>
      <div className="card">
        <strong>Tu montes aussi ?</strong>
        <p className="muted">Horsetrack suit ton cheval : séances en direct, soins, rappels et budget, au même endroit.</p>
        <a className="cta" href="https://horsetrack.fr">Découvrir Horsetrack</a>
      </div>
    </main>
  );
}
