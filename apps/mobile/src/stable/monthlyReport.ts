import type { PdfTextLine } from "@/lib/pdfText";
import { LOCALE, t } from "@/i18n";

/**
 * Rapport mensuel d'un cheval (Écurie Pro v2) : séances et cavaliers, soins,
 * pesées, tâches, et — seulement si celui qui l'établit y a droit —
 * dépenses et participation aux frais. Un document qu'on remet au
 * propriétaire, à la demi-pension ou au coach.
 *
 * Module pur (cf. horses/healthRecord.ts pour le même principe) : on
 * reporte ce qui a été saisi, daté, sans interpréter ni calculer
 * d'indicateur de santé — c'est un relevé, pas un avis.
 */

export type ReportSession = {
  date: Date;
  completed: boolean;
  cancelled: boolean;
  label: string;
  durationMinutes: number | null;
  /** Nom du cavalier (déjà résolu), null si non précisé. */
  riderName: string | null;
};

export type ReportCare = { date: Date; typeLabel: string; title: string; professional: string | null };
export type ReportExpense = { date: Date; amount: number; label: string };
export type ReportWeight = { date: Date; weightKg: number };

export type MonthlyReportInput = {
  horseName: string;
  /** Premier jour du mois. */
  month: Date;
  sessions: ReportSession[];
  care: ReportCare[];
  weights: ReportWeight[];
  tasks: { total: number; done: number } | null;
  /** Fournis seulement si l'appelant a le droit de les montrer. */
  expenses: ReportExpense[] | null;
  fees: { total: number; paid: number; due: number } | null;
};

const day = (d: Date) => d.toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit" });
const euros = (n: number) => new Intl.NumberFormat(LOCALE, { style: "currency", currency: "EUR" }).format(n);

export function inMonth(date: Date, month: Date): boolean {
  return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
}

export type RiderTotal = { name: string | null; sessions: number; minutes: number };

/** Séances faites par cavalier, du plus actif au moins actif. */
export function ridersOf(sessions: ReportSession[]): RiderTotal[] {
  const map = new Map<string, RiderTotal>();
  for (const s of sessions) {
    if (!s.completed || s.cancelled) continue;
    const key = s.riderName ?? "";
    const row = map.get(key) ?? { name: s.riderName, sessions: 0, minutes: 0 };
    row.sessions += 1;
    row.minutes += s.durationMinutes ?? 0;
    map.set(key, row);
  }
  // « Non précisé » toujours en dernier, à égalité de séances.
  return [...map.values()].sort(
    (a, b) => b.sessions - a.sessions || Number(a.name === null) - Number(b.name === null) || (a.name ?? "").localeCompare(b.name ?? "")
  );
}

export function hoursLabel(minutes: number): string {
  if (minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export function buildMonthlyReportLines(input: MonthlyReportInput, today: Date): PdfTextLine[] {
  const monthLabel = input.month.toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
  const lines: PdfTextLine[] = [
    { style: "title", text: t("Rapport de {month} — {name}", { month: monthLabel, name: input.horseName }) },
    { style: "muted", text: t("Établi le {date} depuis HorseTrack", { date: today.toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric" }) }) },
    { style: "space" },
  ];

  const sessions = input.sessions.filter((s) => inMonth(s.date, input.month) && !s.cancelled);
  const done = sessions.filter((s) => s.completed);
  const totalMinutes = done.reduce((n, s) => n + (s.durationMinutes ?? 0), 0);
  lines.push({ style: "heading", text: t("Séances") });
  if (sessions.length === 0) {
    lines.push({ style: "body", text: t("Aucune séance ce mois-ci.") });
  } else {
    lines.push({
      style: "body",
      text:
        t("{done} séance(s) faite(s) sur {total} prévue(s)", { done: done.length, total: sessions.length }) +
        (totalMinutes > 0 ? ` · ${hoursLabel(totalMinutes)}` : ""),
    });
    for (const r of ridersOf(sessions)) {
      lines.push({
        style: "body",
        text: `${r.name ?? t("Cavalier non précisé")} : ${t("{count} séance(s)", { count: r.sessions })}${r.minutes > 0 ? ` · ${hoursLabel(r.minutes)}` : ""}`,
      });
    }
    lines.push({ style: "space" });
    for (const s of [...done].sort((a, b) => a.date.getTime() - b.date.getTime())) {
      lines.push({ style: "body", text: `${day(s.date)} · ${s.label}${s.riderName ? ` · ${s.riderName}` : ""}` });
      if (s.durationMinutes) lines.push({ style: "muted", text: hoursLabel(s.durationMinutes) });
    }
  }
  lines.push({ style: "space" });

  const care = input.care.filter((c) => inMonth(c.date, input.month)).sort((a, b) => a.date.getTime() - b.date.getTime());
  lines.push({ style: "heading", text: t("Soins") });
  if (care.length === 0) lines.push({ style: "body", text: t("Aucun soin ce mois-ci.") });
  for (const c of care) {
    lines.push({ style: "body", text: `${day(c.date)} · ${c.typeLabel}${c.title && c.title !== c.typeLabel ? ` — ${c.title}` : ""}` });
    if (c.professional) lines.push({ style: "muted", text: c.professional });
  }
  lines.push({ style: "space" });

  const weights = input.weights.filter((w) => inMonth(w.date, input.month)).sort((a, b) => a.date.getTime() - b.date.getTime());
  if (weights.length > 0) {
    lines.push({ style: "heading", text: t("Poids") });
    for (const w of weights) lines.push({ style: "body", text: `${day(w.date)} · ${w.weightKg} kg` });
    lines.push({ style: "space" });
  }

  if (input.tasks && input.tasks.total > 0) {
    lines.push({ style: "heading", text: t("Tâches d'écurie") });
    lines.push({ style: "body", text: t("{done} faites sur {total}", { done: input.tasks.done, total: input.tasks.total }) });
    lines.push({ style: "space" });
  }

  if (input.expenses) {
    const expenses = input.expenses.filter((e) => inMonth(e.date, input.month));
    lines.push({ style: "heading", text: t("Dépenses") });
    if (expenses.length === 0) lines.push({ style: "body", text: t("Aucune dépense ce mois-ci.") });
    else {
      lines.push({ style: "body", text: t("Total : {amount}", { amount: euros(expenses.reduce((n, e) => n + e.amount, 0)) }) });
      for (const e of [...expenses].sort((a, b) => a.date.getTime() - b.date.getTime())) {
        lines.push({ style: "muted", text: `${day(e.date)} · ${e.label} · ${euros(e.amount)}` });
      }
    }
    lines.push({ style: "space" });
  }

  if (input.fees && input.fees.total > 0) {
    lines.push({ style: "heading", text: t("Participation aux frais") });
    lines.push({ style: "body", text: t("{paid} reçus sur {total}", { paid: euros(input.fees.paid), total: euros(input.fees.total) }) });
    if (input.fees.due > 0) lines.push({ style: "muted", text: t("Reste à recevoir : {amount}", { amount: euros(input.fees.due) }) });
    lines.push({ style: "space" });
  }

  lines.push({ style: "muted", text: t("Relevé de ce qui a été noté dans l'app, sans avis médical.") });
  return lines;
}
