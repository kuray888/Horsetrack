import type { WeekBucket } from "@/lib/adminReports";
import s from "./admin.module.css";

const weekFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" });
const weekLabel = (w: WeekBucket) => weekFmt.format(new Date(`${w.weekStart}T00:00:00Z`));

/** Graduation lisible au-dessus du maximum : 1, 2, 5, 10, 20, 50… */
function niceCeil(n: number): number {
  if (n <= 1) return 1;
  const pow = 10 ** Math.floor(Math.log10(n));
  return [1, 2, 5, 10].map((m) => m * pow).find((v) => v >= n) ?? 10 * pow;
}

/**
 * Inscriptions par semaine : une seule série, donc une seule couleur et pas
 * de légende. Survol : info-bulle native de chaque colonne (toute la hauteur,
 * plus facile à viser que la barre, surlignée derrière elle). La semaine en cours, incomplète, est
 * plus claire et marquée « en cours ». Le tableau sous le graphique donne
 * les mêmes chiffres, lisibles sans la vue.
 */
export function SignupsChart({ weeks }: { weeks: WeekBucket[] }) {
  const W = 640;
  const H = 180;
  const pad = { top: 22, right: 8, bottom: 26, left: 30 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const max = niceCeil(Math.max(...weeks.map((w) => w.count)));
  const slot = plotW / weeks.length;
  const barW = Math.min(36, slot - 2);
  const y = (v: number) => pad.top + plotH - (v / max) * plotH;
  const peak = weeks.reduce((best, w, i) => (w.count > weeks[best].count ? i : best), 0);
  const total = weeks.reduce((n, w) => n + w.count, 0);
  const last = weeks.length - 1;

  return (
    <figure className={s.chart}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Inscriptions par semaine sur ${weeks.length} semaines : ${total} au total, au plus ${weeks[peak].count} la semaine du ${weekLabel(weeks[peak])}.`}
      >
        {[0, max / 2, max].map((v) => (
          <g key={v}>
            <line x1={pad.left} x2={W - pad.right} y1={y(v)} y2={y(v)} className={v === 0 ? s.chartBaseline : s.chartGrid} />
            <text x={pad.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className={s.chartTick}>
              {Number.isInteger(v) ? v : ""}
            </text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const cx = pad.left + slot * i + slot / 2;
          const h = Math.max(0, y(0) - y(w.count));
          const r = Math.min(4, h, barW / 2);
          const x0 = cx - barW / 2;
          const top = y(w.count);
          // Coins arrondis en haut seulement : la barre reste posée sur l'axe.
          const d = `M${x0},${y(0)} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${y(0)} Z`;
          const label = i === last || (i === peak && w.count > 0);
          return (
            <g key={w.weekStart} className={s.chartCol}>
              <title>{`Semaine du ${weekLabel(w)}${i === last ? " (en cours)" : ""} : ${w.count} inscription${w.count > 1 ? "s" : ""}`}</title>
              <rect x={pad.left + slot * i} y={pad.top} width={slot} height={plotH} className={s.chartHit} />
              {h > 0 ? <path d={d} className={i === last ? s.chartBarCurrent : s.chartBar} /> : null}
              {label ? (
                <text x={cx} y={top - 6} textAnchor="middle" className={s.chartValue}>
                  {w.count}
                  {i === last ? " · en cours" : ""}
                </text>
              ) : null}
              {i % 2 === last % 2 ? (
                <text x={cx} y={H - 8} textAnchor="middle" className={s.chartTick}>
                  {weekLabel(w)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <details className={s.chartTable}>
        <summary>Voir les chiffres</summary>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Semaine du</th>
              <th>Inscriptions</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w, i) => (
              <tr key={w.weekStart}>
                <td>
                  {weekLabel(w)}
                  {i === last ? " (en cours)" : ""}
                </td>
                <td>{w.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
