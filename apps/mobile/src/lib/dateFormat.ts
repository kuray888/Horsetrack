import { LANG, t } from "@/i18n";

export const MONTHS =
  LANG === "fr"
    ? ["jan.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
    : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Initiales des jours, lundi en tête. */
export const DAY_LABELS = LANG === "fr" ? ["L", "M", "M", "J", "V", "S", "D"] : ["M", "T", "W", "T", "F", "S", "S"];
export const WEEK_DAYS_FULL = [t("Lundi"), t("Mardi"), t("Mercredi"), t("Jeudi"), t("Vendredi"), t("Samedi"), t("Dimanche")];

export function formatDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Jour au format AAAA-MM-JJ, en heure locale : c'est la date que le cavalier
 * a saisie (les dates sont stockées à minuit local, cf. serverDate.ts). Seul
 * format lu sans ambiguïté par les tableurs (export) et par Swift (widget). */
export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function isSameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatDuration(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return t("{m} min", { m: m });
  if (m === 0) return t("{h} h", { h: h });
  return t("{h} h {m}", { h: h, m: m });
}
