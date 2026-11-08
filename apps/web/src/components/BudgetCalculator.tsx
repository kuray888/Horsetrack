"use client";

import { useMemo, useState } from "react";
import { AppStoreBadge } from "./AppStoreBadge";
import styles from "./BudgetCalculator.module.css";

type Period = "month" | "year";
type Field = { id: string; label: string; hint?: string; period: Period; value: number };

/** Valeurs d'EXEMPLE, à remplacer par les siennes : elles servent à montrer
 * l'ordre de grandeur des postes, pas à dire ce que coûte « un » cheval. */
const DEFAULTS: Field[] = [
  { id: "pension", label: "Pension", hint: "Pré, box, avec ou sans travail", period: "month", value: 450 },
  { id: "food", label: "Alimentation en plus", hint: "Granulés, foin, compléments", period: "month", value: 40 },
  { id: "insurance", label: "Assurance", period: "month", value: 25 },
  { id: "vet", label: "Vétérinaire et vaccins", period: "year", value: 250 },
  { id: "dentist", label: "Dentiste", period: "year", value: 100 },
  { id: "osteo", label: "Ostéopathe et soins", period: "year", value: 150 },
  { id: "deworm", label: "Vermifuges ou coproscopies", period: "year", value: 60 },
  { id: "gear", label: "Équipement et sellerie", period: "year", value: 300 },
  { id: "competition", label: "Compétitions", hint: "Engagements, transport, licence", period: "year", value: 0 },
  { id: "reserve", label: "Réserve pour imprévus", hint: "Colique, boiterie, blessure", period: "month", value: 30 },
];

const PENSION_PRESETS = [
  { label: "Au pré", value: 200 },
  { label: "En box", value: 450 },
  { label: "Box + travail", value: 650 },
];

const euro = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function BudgetCalculator() {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(DEFAULTS.map((f) => [f.id, f.value]))
  );
  const [farrierPrice, setFarrierPrice] = useState(90);
  const [farrierWeeks, setFarrierWeeks] = useState(7);

  const lines = useMemo(() => {
    const farrierMonthly = farrierWeeks > 0 ? (farrierPrice * 52) / farrierWeeks / 12 : 0;
    const rows = DEFAULTS.map((f) => ({
      id: f.id,
      label: f.label,
      monthly: f.period === "month" ? values[f.id] : values[f.id] / 12,
    }));
    rows.splice(2, 0, { id: "farrier", label: "Maréchal-ferrant", monthly: farrierMonthly });
    return rows.filter((r) => r.monthly > 0).sort((a, b) => b.monthly - a.monthly);
  }, [values, farrierPrice, farrierWeeks]);

  const monthly = lines.reduce((sum, r) => sum + r.monthly, 0);
  const max = lines[0]?.monthly ?? 1;

  const set = (id: string, raw: string) => {
    const n = Number(raw.replace(",", "."));
    setValues((v) => ({ ...v, [id]: Number.isFinite(n) && n >= 0 ? n : 0 }));
  };

  return (
    <div className={styles.layout}>
      <form className={styles.form} onSubmit={(e) => e.preventDefault()} aria-label="Vos dépenses">
        <fieldset className={styles.group}>
          <legend>Pension</legend>
          <div className={styles.presets} role="group" aria-label="Exemples de pension">
            {PENSION_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className={values.pension === p.value ? styles.presetOn : styles.preset}
                aria-pressed={values.pension === p.value}
                onClick={() => setValues((v) => ({ ...v, pension: p.value }))}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Amount id="pension" label="Montant de votre pension" suffix="€ / mois" value={values.pension} onChange={set} />
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Maréchal-ferrant</legend>
          <div className={styles.row}>
            <Amount
              id="farrier-price"
              label="Prix d'un passage"
              suffix="€"
              value={farrierPrice}
              onChange={(_, raw) => setFarrierPrice(Math.max(0, Number(raw.replace(",", ".")) || 0))}
            />
            <Amount
              id="farrier-weeks"
              label="Toutes les"
              suffix="semaines"
              value={farrierWeeks}
              onChange={(_, raw) => setFarrierWeeks(Math.max(0, Number(raw.replace(",", ".")) || 0))}
            />
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Chaque mois</legend>
          {DEFAULTS.filter((f) => f.period === "month" && f.id !== "pension").map((f) => (
            <Amount key={f.id} id={f.id} label={f.label} hint={f.hint} suffix="€ / mois" value={values[f.id]} onChange={set} />
          ))}
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Chaque année</legend>
          {DEFAULTS.filter((f) => f.period === "year").map((f) => (
            <Amount key={f.id} id={f.id} label={f.label} hint={f.hint} suffix="€ / an" value={values[f.id]} onChange={set} />
          ))}
        </fieldset>
        <p className={styles.note}>
          Les montants proposés sont des exemples : remplacez-les par les vôtres. Ils varient beaucoup selon la région,
          l&apos;écurie et le cheval.
        </p>
      </form>

      <aside className={styles.result} aria-live="polite" aria-label="Votre budget">
        <p className={styles.kicker}>Votre cheval vous coûte environ</p>
        <p className={styles.total}>
          {euro(monthly)}
          <span> / mois</span>
        </p>
        <p className={styles.yearly}>soit {euro(monthly * 12)} par an</p>

        <ul className={styles.bars} role="list">
          {lines.map((r) => (
            <li key={r.id}>
              <div className={styles.barHead}>
                <span>{r.label}</span>
                <span>{euro(r.monthly)}</span>
              </div>
              <div className={styles.track} aria-hidden="true">
                <div className={styles.fill} style={{ width: `${Math.max(4, (r.monthly / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>

        <div className={styles.cta}>
          <p>Suivez vos vraies dépenses, ce qui est payé et ce qui reste à régler, dans Horsetrack.</p>
          <AppStoreBadge />
        </div>
      </aside>
    </div>
  );
}

function Amount({
  id,
  label,
  hint,
  suffix,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  suffix: string;
  value: number;
  onChange: (id: string, raw: string) => void;
}) {
  return (
    <label className={styles.field} htmlFor={`f-${id}`}>
      <span className={styles.label}>
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
      <span className={styles.input}>
        <input
          id={`f-${id}`}
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={value}
          onChange={(e) => onChange(id, e.target.value)}
        />
        <span>{suffix}</span>
      </span>
    </label>
  );
}
