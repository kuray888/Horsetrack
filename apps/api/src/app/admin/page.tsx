import type { Metadata } from "next";
import { describeDiscount } from "@/lib/promoRules";
import { REDEMPTION_LABEL, STATUS_LABEL, bucketByWeek } from "@/lib/adminReports";
import {
  findAccountByEmail,
  loadActivationFunnel,
  loadAdminStats,
  loadWeeklyActiveRiders,
  loadPromoCodes,
  loadRecentRedemptions,
  loadSignupDates,
  loadOpenCommentReports,
  type AdminPromoCode,
} from "@/lib/adminData";
import { createPromoCode, handleCommentReport, setPromoCodeActive } from "./actions";
import { SignupsChart } from "./SignupsChart";
import s from "./admin.module.css";

export const dynamic = "force-dynamic";

/** Profondeur du graphique des inscriptions. */
const SIGNUP_WEEKS = 12;
export const metadata: Metadata = { title: "Horsetrack · Admin", robots: { index: false, follow: false } };

const dateFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const fmt = (d: Date | null) => (d ? dateFmt.format(d) : "—");

const ELIGIBILITY_LABEL: Record<string, string> = {
  ANYONE: "Tous",
  NEVER_SUBSCRIBED: "Jamais abonnés",
  LAPSED_SUBSCRIBERS: "Anciens abonnés",
};

function pct(n: number, total: number): string {
  return total > 0 ? `${Math.round((n / total) * 100)} %` : "—";
}

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className={s.kpi}>
      <span className={s.kpiLabel}>{label}</span>
      <strong className={s.kpiValue}>{value}</strong>
      {hint ? <span className={s.kpiHint}>{hint}</span> : null}
    </div>
  );
}

function codeState(c: AdminPromoCode, now: Date): { label: string; tone: "ok" | "muted" | "warn" } {
  if (!c.active) return { label: "Désactivé", tone: "muted" };
  if (c.expiresAt && c.expiresAt < now) return { label: "Expiré", tone: "muted" };
  if (c.startsAt && c.startsAt > now) return { label: "Programmé", tone: "warn" };
  if (c.maxRedemptions !== null && c.uses >= c.maxRedemptions) return { label: "Épuisé", tone: "warn" };
  return { label: "Actif", tone: "ok" };
}

function CodeRow({ c, now }: { c: AdminPromoCode; now: Date }) {
  const state = codeState(c, now);
  const isStore = c.kind === "STORE_OFFER";
  const benefit = isStore
    ? `Offre store ${describeDiscount(c.discountType, c.discountValue) ?? ""}`.trim()
    : `${c.premiumDays} j de Premium`;
  const conditions = [
    c.eligibility !== "ANYONE" ? ELIGIBILITY_LABEL[c.eligibility] : null,
    c.maxAccountAgeDays ? `compte ≤ ${c.maxAccountAgeDays} j` : null,
  ].filter(Boolean);
  const usage = c.maxRedemptions !== null ? Math.min(1, c.uses / c.maxRedemptions) : null;
  return (
    <tr>
      <td>
        <code className={s.code}>{c.code}</code>
        {isStore && c.storeOfferCode && c.storeOfferCode !== c.code ? (
          <div className={s.sub}>App Store : {c.storeOfferCode}</div>
        ) : null}
        {c.campaign ? <div className={s.sub}>#{c.campaign}</div> : null}
      </td>
      <td>
        {benefit}
        {c.description ? <div className={s.sub}>« {c.description} »</div> : null}
      </td>
      <td>{conditions.length ? conditions.join(" · ") : <span className={s.sub}>Aucune</span>}</td>
      <td className={s.nowrap}>
        {c.startsAt ? `du ${fmt(c.startsAt)}` : null}
        {c.startsAt && c.expiresAt ? <br /> : null}
        {c.expiresAt ? `au ${fmt(c.expiresAt)}` : null}
        {!c.startsAt && !c.expiresAt ? <span className={s.sub}>Sans limite</span> : null}
      </td>
      <td>
        <strong>{c.uses}</strong>
        {c.maxRedemptions !== null ? ` / ${c.maxRedemptions}` : ""}
        {usage !== null ? (
          <div className={s.bar} aria-hidden>
            <span style={{ width: `${usage * 100}%` }} />
          </div>
        ) : null}
      </td>
      <td>
        {isStore ? (
          <>
            <strong>{c.converted}</strong> achat{c.converted > 1 ? "s" : ""}
            <div className={s.sub}>{pct(c.converted, c.uses)} des utilisations</div>
          </>
        ) : (
          <>
            <strong>{c.applied}</strong> accordé{c.applied > 1 ? "s" : ""}
            {c.alreadyPremium ? <div className={s.sub}>+{c.alreadyPremium} déjà Premium</div> : null}
          </>
        )}
      </td>
      <td>
        <span className={`${s.pill} ${s[state.tone]}`}>{state.label}</span>
      </td>
      <td>
        <form action={setPromoCodeActive}>
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="active" value={c.active ? "false" : "true"} />
          <button type="submit" className={s.linkButton}>
            {c.active ? "Désactiver" : "Réactiver"}
          </button>
        </form>
      </td>
    </tr>
  );
}

function CreateCodeForm() {
  return (
    <form action={createPromoCode} className={s.form}>
      <fieldset className={s.kindPicker}>
        <legend>Type de code</legend>
        <label>
          <input type="radio" name="kind" value="PREMIUM_DAYS" defaultChecked />
          <span>
            <strong>Jours de Premium offerts</strong>
            <small>Accordés par Horsetrack, sans paiement.</small>
          </span>
        </label>
        <label>
          <input type="radio" name="kind" value="STORE_OFFER" />
          <span>
            <strong>Remise sur l&apos;abonnement</strong>
            <small>% , montant ou mois offerts — appliquée par Apple via un code d&apos;offre.</small>
          </span>
        </label>
      </fieldset>

      <div className={s.grid}>
        <label className={s.field}>
          <span>Code</span>
          <input name="code" required placeholder="EQUITA26" autoComplete="off" />
        </label>
        <label className={`${s.field} ${s.daysOnly}`}>
          <span>Jours de Premium</span>
          <input name="premiumDays" type="number" min={1} max={366} placeholder="30" />
        </label>
        <label className={`${s.field} ${s.storeOnly}`}>
          <span>Code d&apos;offre App Store</span>
          <input name="storeOfferCode" placeholder="Identique si vide" autoComplete="off" />
        </label>
        <label className={`${s.field} ${s.storeOnly}`}>
          <span>Remise (suivi)</span>
          <select name="discountType" defaultValue="">
            <option value="">Non précisée</option>
            <option value="PERCENT">Pourcentage</option>
            <option value="AMOUNT">Montant (centimes)</option>
            <option value="FREE_PERIOD">Mois offerts</option>
          </select>
        </label>
        <label className={`${s.field} ${s.storeOnly}`}>
          <span>Valeur</span>
          <input name="discountValue" type="number" min={1} placeholder="30" />
        </label>
        <label className={s.field}>
          <span>Début (facultatif)</span>
          <input name="startsAt" type="date" />
        </label>
        <label className={s.field}>
          <span>Fin (facultatif)</span>
          <input name="expiresAt" type="date" />
        </label>
        <label className={s.field}>
          <span>Utilisations max</span>
          <input name="maxRedemptions" type="number" min={1} placeholder="Illimité" />
        </label>
        <label className={s.field}>
          <span>Réservé à</span>
          <select name="eligibility" defaultValue="ANYONE">
            <option value="ANYONE">Tous les comptes</option>
            <option value="NEVER_SUBSCRIBED">Jamais abonnés</option>
            <option value="LAPSED_SUBSCRIBERS">Anciens abonnés</option>
          </select>
        </label>
        <label className={s.field}>
          <span>Compte créé depuis ≤ (jours)</span>
          <input name="maxAccountAgeDays" type="number" min={1} placeholder="Sans condition" />
        </label>
        <label className={s.field}>
          <span>Campagne</span>
          <input name="campaign" placeholder="salon-equita-2026" maxLength={60} />
          <small className={s.sub}>
            « retour » : offre de retour, proposée d&apos;elle-même dans l&apos;app aux comptes redevenus gratuits
            (remise sur l&apos;abonnement uniquement).
          </small>
        </label>
        <label className={`${s.field} ${s.wide}`}>
          <span>Message affiché à l&apos;utilisateur</span>
          <input name="description" maxLength={140} placeholder="30 jours de Premium offerts par Equita !" />
        </label>
      </div>

      <p className={`${s.note} ${s.storeOnly}`}>
        Crée d&apos;abord le code personnalisé dans App Store Connect (Abonnements → Codes d&apos;offre), avec la même
        remise et la même date de fin. Horsetrack vérifie ses propres conditions, puis ouvre la feuille Apple :
        c&apos;est elle qui affiche le prix remisé et facture. La remise saisie ici sert uniquement au suivi.
      </p>
      <button type="submit" className={s.primary}>
        Créer le code
      </button>
    </form>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; q?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const [stats, funnel, weeklyActive, codes, recent, account, signupDates, reports] = await Promise.all([
    loadAdminStats(now),
    loadActivationFunnel(30, now),
    loadWeeklyActiveRiders(now),
    loadPromoCodes(),
    loadRecentRedemptions(),
    params.q ? findAccountByEmail(params.q) : Promise.resolve(null),
    loadSignupDates(SIGNUP_WEEKS, now),
    // Table du bloc C : tant que son SQL n'est pas exécuté, pas de section.
    loadOpenCommentReports().catch(() => null),
  ]);
  const signups = bucketByWeek(signupDates, SIGNUP_WEEKS, now);
  const paid = stats.paidMonthly + stats.paidAnnual + stats.paidOther;
  const rider = account?.riderProfile ?? null;

  return (
    <main className={s.page}>
      <header className={s.header}>
        <div>
          <p className={s.eyebrow}>Horsetrack</p>
          <h1>Administration</h1>
        </div>
        <span className={s.sub}>Données au {dateTimeFmt.format(now)}</span>
      </header>

      {params.ok ? (
        <p className={`${s.flash} ${s.flashOk}`} role="status">
          {params.ok}
        </p>
      ) : null}
      {params.error ? (
        <p className={`${s.flash} ${s.flashError}`} role="alert">
          {params.error}
        </p>
      ) : null}

      <section aria-labelledby="kpis">
        <h2 id="kpis" className={s.h2}>
          Vue d&apos;ensemble
        </h2>
        <div className={s.kpis}>
          <Kpi label="Comptes" value={stats.accounts} hint={`${stats.onboarded} inscriptions terminées`} />
          <Kpi label="Nouveaux" value={stats.newLast7} hint={`7 derniers jours · ${stats.newLast30} sur 30 j`} />
          <Kpi label="Abonnés payants" value={paid} hint={`${pct(paid, stats.accounts)} des comptes`} />
          <Kpi
            label="Répartition"
            value={`${stats.paidAnnual} / ${stats.paidMonthly}`}
            hint={`annuel / mensuel${stats.paidOther ? ` · ${stats.paidOther} offerts` : ""}`}
          />
          <Kpi label="Essais en cours" value={stats.trialsRunning} hint="store et codes promo" />
          <Kpi label="Chevaux suivis" value={stats.horses} />
          <Kpi label="Actifs 7 jours" value={weeklyActive} hint="ont noté ou coché une séance" />
        </div>
        <p className={s.note}>
          Le chiffre d&apos;affaires, les remboursements et les résiliations font foi dans RevenueCat et App Store Connect.
        </p>
      </section>

      <section aria-labelledby="signups-title">
        <div className={s.sectionHead}>
          <h2 id="signups-title" className={s.h2}>
            Inscriptions par semaine
          </h2>
          <nav className={s.exports} aria-label="Exports CSV">
            <span className={s.sub}>Exporter (CSV) :</span>
            <a href="/admin/export/comptes" download>
              Comptes
            </a>
            <a href="/admin/export/codes" download>
              Codes
            </a>
            <a href="/admin/export/utilisations" download>
              Utilisations
            </a>
          </nav>
        </div>
        <SignupsChart weeks={signups} />
        <p className={s.note}>Comptes créés, du lundi au dimanche, heure de Paris. Les exports s&apos;ouvrent dans Excel ou Numbers.</p>
      </section>

      <section aria-labelledby="funnel-title">
        <h2 id="funnel-title" className={s.h2}>
          Activation des nouveaux comptes (30 derniers jours)
        </h2>
        <ol className={s.funnel}>
          {funnel.map((step, i) => {
            const base = funnel[0].count;
            const previous = i > 0 ? funnel[i - 1].count : null;
            return (
              <li key={step.label}>
                <div className={s.funnelHead}>
                  <span>{step.label}</span>
                  <strong>{step.count}</strong>
                </div>
                <div className={s.funnelBar} aria-hidden>
                  <span style={{ width: `${base ? Math.max(2, (step.count / base) * 100) : 0}%` }} />
                </div>
                <span className={s.sub}>
                  {pct(step.count, base)} des inscrits
                  {previous !== null ? ` · ${pct(step.count, previous)} de l'étape précédente` : ""}
                </span>
              </li>
            );
          })}
        </ol>
        <p className={s.note}>
          Lu dans la base, sans traceur. Le plus gros écart d&apos;une étape à l&apos;autre est le premier endroit à
          améliorer.
        </p>
      </section>

      <section aria-labelledby="codes-title" id="codes">
        <h2 id="codes-title" className={s.h2}>
          Codes promo
        </h2>
        {codes.length === 0 ? (
          <p className={s.empty}>Aucun code pour l&apos;instant. Crée le premier ci-dessous.</p>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Avantage</th>
                  <th>Conditions</th>
                  <th>Validité</th>
                  <th>Utilisations</th>
                  <th>Résultat</th>
                  <th>Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <CodeRow key={c.id} c={c} now={now} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <details className={s.card} open={codes.length === 0 || !!params.error}>
          <summary>Nouveau code</summary>
          <CreateCodeForm />
        </details>
      </section>

      {reports && reports.length > 0 ? (
        <section aria-labelledby="signalements-title" id="signalements">
          <h2 id="signalements-title" className={s.h2}>
            Commentaires signalés ({reports.length})
          </h2>
          <ul className={s.list}>
            {reports.map((r) => (
              <li key={r.id}>
                <span className={s.ellipsis}>« {r.comment.body} »</span>
                <span className={s.sub}>
                  {r.comment.author.email} ({r.comment.authorRole}) · signalé le {dateTimeFmt.format(r.createdAt)}
                  {r.reason ? ` · ${r.reason}` : ""}
                </span>
                <form action={handleCommentReport} className={s.exports}>
                  <input type="hidden" name="commentId" value={r.comment.id} />
                  <button type="submit" name="decision" value="delete" className={s.linkButton}>
                    Supprimer le commentaire
                  </button>
                  <button type="submit" name="decision" value="keep" className={s.linkButton}>
                    Classer
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <p className={s.note}>À traiter sous 24 h (règle App Store 1.2). Supprimer retire le commentaire du fil pour tout le monde.</p>
        </section>
      ) : null}

      <div className={s.columns}>
        <section aria-labelledby="recent">
          <h2 id="recent" className={s.h2}>
            Dernières utilisations
          </h2>
          {recent.length === 0 ? (
            <p className={s.empty}>Aucune utilisation.</p>
          ) : (
            <ul className={s.list}>
              {recent.map((r) => (
                <li key={r.id}>
                  <code className={s.code}>{r.promoCode.code}</code>
                  <span className={s.ellipsis}>{r.rider.user.email}</span>
                  <span className={s.sub}>
                    {REDEMPTION_LABEL[r.status]} · {dateTimeFmt.format(r.convertedAt ?? r.redeemedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="lookup">
          <h2 id="lookup" className={s.h2}>
            Rechercher un compte
          </h2>
          <form method="get" className={s.search}>
            <input name="q" type="email" placeholder="email@exemple.fr" defaultValue={params.q ?? ""} required />
            <button type="submit" className={s.primary}>
              Chercher
            </button>
          </form>
          {params.q && !account ? <p className={s.empty}>Aucun compte avec cet email.</p> : null}
          {account ? (
            <dl className={s.account}>
              <dt>Email</dt>
              <dd>{account.email}</dd>
              <dt>Inscrit le</dt>
              <dd>{fmt(account.createdAt)}</dd>
              {/* Identifiant que l'app donne à RevenueCat (cf. loginRevenueCat) :
                  c'est lui qu'on recherche dans RevenueCat pour offrir Premium
                  à une ambassadrice (« Grant promotional entitlement »). */}
              <dt>ID RevenueCat</dt>
              <dd>
                <code className={s.code}>{account.id}</code>
              </dd>
              <dt>Abonnement</dt>
              <dd>
                {rider ? (
                  <>
                    {STATUS_LABEL[rider.subscriptionStatus] ?? rider.subscriptionStatus}
                    {rider.billingPeriod ? ` · ${rider.billingPeriod === "ANNUAL" ? "annuel" : "mensuel"}` : ""}
                    {rider.subscriptionStatus === "TRIALING" && rider.trialEndsAt ? ` · jusqu'au ${fmt(rider.trialEndsAt)}` : ""}
                  </>
                ) : (
                  "Profil non créé (inscription inachevée)"
                )}
              </dd>
              {rider ? (
                <>
                  <dt>Store</dt>
                  <dd>
                    {rider.revenuecatId ? "Client RevenueCat" : "Jamais passé par le store"}
                    {rider.lastWebhookEventAt ? ` · dernier événement ${fmt(rider.lastWebhookEventAt)}` : ""}
                  </dd>
                  <dt>Chevaux</dt>
                  <dd>{rider._count.horses}</dd>
                  <dt>Codes</dt>
                  <dd>
                    {rider.promoRedemptions.length
                      ? rider.promoRedemptions
                          .map((r) => `${r.promoCode.code} (${REDEMPTION_LABEL[r.status]}, ${fmt(r.redeemedAt)})`)
                          .join(" · ")
                      : "Aucun"}
                  </dd>
                </>
              ) : null}
            </dl>
          ) : null}
          <p className={s.note}>
            Lecture seule : l&apos;abonnement se gère dans RevenueCat (octroi, remboursement), jamais à la main en base.
          </p>
        </section>
      </div>
    </main>
  );
}
