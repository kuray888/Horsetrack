import type { PdfTextLine } from "@/lib/pdfText";
import { LOCALE, t } from "@/i18n";

/**
 * Relevé de dépenses d'un cheval pour une année (Premium) : totaux payé / à
 * régler, répartition par catégorie, mois par mois, puis le détail. À remettre
 * à un comptable, à la demi-pension ou à un acheteur, ou à garder.
 *
 * Module pur, comme monthlyReport.ts : on reporte ce qui a été saisi, sans
 * interpréter. Une seule devise (euros), comme l'écran Budget.
 */

export type BudgetExpense = {
  date: Date;
  amount: number;
  /** Libellé de la catégorie, déjà traduit. */
  categoryLabel: string;
  notes: string;
  isPaid: boolean;
};

export type BudgetReportInput = { horseName: string; year: number; expenses: BudgetExpense[] };

const euros = (n: number) => new Intl.NumberFormat(LOCALE, { style: "currency", currency: "EUR" }).format(n);
const day = (d: Date) => d.toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit" });
const sum = (list: BudgetExpense[]) => list.reduce((n, e) => n + e.amount, 0);

export function expensesOfYear(expenses: BudgetExpense[], year: number): BudgetExpense[] {
  return expenses.filter((e) => e.date.getFullYear() === year).sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Années qui ont au moins une dépense, de la plus récente à la plus ancienne. */
export function yearsWithExpenses(expenses: Pick<BudgetExpense, "date">[]): number[] {
  return [...new Set(expenses.map((e) => e.date.getFullYear()))].sort((a, b) => b - a);
}

export function buildBudgetReportLines(input: BudgetReportInput, today: Date): PdfTextLine[] {
  const list = expensesOfYear(input.expenses, input.year);
  const lines: PdfTextLine[] = [
    { style: "title", text: t("Dépenses {year} — {name}", { year: input.year, name: input.horseName }) },
    {
      style: "muted",
      text: t("Établi le {date} depuis HorseTrack", {
        date: today.toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric" }),
      }),
    },
    { style: "space" },
  ];
  if (list.length === 0) {
    lines.push({ style: "body", text: t("Aucune dépense cette année-là.") });
    return lines;
  }

  const total = sum(list);
  const paid = sum(list.filter((e) => e.isPaid));
  lines.push({ style: "heading", text: t("Total") });
  lines.push({ style: "body", text: t("Total : {amount}", { amount: euros(total) }) });
  lines.push({ style: "body", text: t("Payé : {amount}", { amount: euros(paid) }) });
  lines.push({ style: "body", text: t("Reste à régler : {amount}", { amount: euros(total - paid) }) });
  lines.push({ style: "space" });

  const byCategory = new Map<string, number>();
  for (const e of list) byCategory.set(e.categoryLabel, (byCategory.get(e.categoryLabel) ?? 0) + e.amount);
  lines.push({ style: "heading", text: t("Par catégorie") });
  for (const [label, amount] of [...byCategory].sort((a, b) => b[1] - a[1])) {
    lines.push({ style: "body", text: `${label} : ${euros(amount)}` });
  }
  lines.push({ style: "space" });

  lines.push({ style: "heading", text: t("Mois par mois") });
  for (let m = 0; m < 12; m++) {
    const month = list.filter((e) => e.date.getMonth() === m);
    if (month.length === 0) continue;
    const label = new Date(input.year, m, 1).toLocaleDateString(LOCALE, { month: "long" });
    lines.push({ style: "body", text: `${label} : ${euros(sum(month))}` });
  }
  lines.push({ style: "space" });

  lines.push({ style: "heading", text: t("Détail") });
  for (const e of list) {
    lines.push({ style: "body", text: `${day(e.date)} · ${e.categoryLabel} · ${euros(e.amount)}${e.isPaid ? "" : ` · ${t("à régler")}`}` });
    if (e.notes.trim()) lines.push({ style: "muted", text: e.notes.trim() });
  }
  lines.push({ style: "space" });
  lines.push({ style: "muted", text: t("Relevé de ce qui a été noté dans l'app.") });
  return lines;
}

/** Lignes du CSV (en-tête exclu) : la date reste un objet Date, mise en forme
 * par `toCsv`. */
export function budgetCsvRows(input: BudgetReportInput): (Date | string | number | boolean)[][] {
  return expensesOfYear(input.expenses, input.year).map((e) => [e.date, e.categoryLabel, e.amount, e.isPaid, e.notes]);
}
