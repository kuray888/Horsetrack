import type { Partnership } from "@/extras/model";

/**
 * Participation aux frais d'une demi-pension, mois par mois (Écurie Pro v2) :
 * du suivi, jamais d'argent qui transite par l'app. Logique pure, testée.
 */

export type Fee = {
  /** "fee_<cheval>_<payeur>_<AAAA-MM>" : une ligne par payeur et par mois. */
  id: string;
  horseId: string;
  payerUserId: string | null;
  payerName: string | null;
  /** "AAAA-MM" */
  month: string;
  amount: number;
  paidAt: Date | null;
  notes: string;
  updatedAt: string;
};

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
}

/** Identifiant stable : deux appareils hors ligne écrivent la même ligne. */
export function feeId(horseId: string, payerUserId: string | null, payerName: string | null, month: string): string {
  const payer = payerUserId ?? `n_${(payerName ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30) || "x"}`;
  return `fee_${horseId}_${payer}_${month}`;
}

export type MonthSummary = { total: number; paid: number; due: number; allPaid: boolean; count: number };

export function summarizeMonth(fees: Fee[], horseId: string, month: string): MonthSummary {
  const rows = fees.filter((f) => f.horseId === horseId && f.month === month);
  const total = rows.reduce((n, f) => n + f.amount, 0);
  const paid = rows.filter((f) => f.paidAt).reduce((n, f) => n + f.amount, 0);
  const round = (n: number) => Math.round(n * 100) / 100;
  return { total: round(total), paid: round(paid), due: round(total - paid), allPaid: rows.length > 0 && paid === total, count: rows.length };
}

/** Participation de la fiche demi-pension pas encore saisie ce mois-là :
 * propose la ligne, sans l'écrire (le propriétaire confirme d'un toucher). */
export function suggestedFee(
  partnership: Partnership | null,
  fees: Fee[],
  horseId: string,
  month: string
): { payerName: string; amount: number } | null {
  const amount = partnership?.monthlyFee;
  const name = partnership?.riderName.trim();
  if (!amount || amount <= 0 || !name) return null;
  if (fees.some((f) => f.horseId === horseId && f.month === month)) return null;
  return { payerName: name, amount };
}

/** Lignes impayées des mois passés (hors mois courant), pour le rappel au
 * propriétaire sur l'écran. */
export function overdueFees(fees: Fee[], horseId: string, currentMonth: string): Fee[] {
  return fees.filter((f) => f.horseId === horseId && !f.paidAt && f.month < currentMonth).sort((a, b) => a.month.localeCompare(b.month));
}

/** « 150 € » sans décimales inutiles. */
export function formatEuros(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", minimumFractionDigits: amount % 1 === 0 ? 0 : 2 }).format(amount);
}
