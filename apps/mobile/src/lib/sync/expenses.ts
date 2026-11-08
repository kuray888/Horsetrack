import { supabase } from "@/lib/supabase";
import { parseServerDate } from "@/lib/serverDate";
import type { Expense } from "@/agenda/store";
import { settleWrite } from "./shared";

/** Dépenses.
 * Extrait de lib/cloudSync.ts (façade) sans changement de comportement. */

function expenseCategoryToDb(category: Expense["category"]): string {
  return category.toUpperCase();
}
function expenseCategoryFromDb(category: string): Expense["category"] {
  return category.toLowerCase() as Expense["category"];
}
export async function pushExpenseImpl(expense: Expense, stamp?: number): Promise<void> {
  if (!expense.horseId) return;
  const row = {
    id: expense.id,
    horseId: expense.horseId,
    amount: expense.amount,
    currency: expense.currency,
    category: expenseCategoryToDb(expense.category),
    date: expense.date.toISOString(),
    notes: expense.notes,
    appointmentId: expense.appointmentId,
    documentId: expense.documentId,
    isPaid: expense.isPaid,
    updatedAt: new Date().toISOString(),
  };
  const { error } = await supabase.from("expenses").upsert(row);
  await settleWrite("pushExpense", "expenses", expense.id, error, row, stamp);
}
export async function deleteExpenseRemoteImpl(expenseId: string, stamp?: number): Promise<void> {
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
  await settleWrite("deleteExpenseRemote", "expenses", expenseId, error, undefined, stamp);
}
/** Restaure les dépenses visibles par l'utilisateur courant — possédées ET
 * partagées (géré entièrement par RLS, cf. pullAppointments ci-dessus). Le
 * lien vers un document (reçu) n'est PAS résolu ici en jointure imbriquée :
 * un collaborateur consultant une dépense partagée dont le reçu appartient
 * au propriétaire (RLS `documents` = owns_rider_profile, jamais partagée) ne
 * l'aura de toute façon jamais dans son propre `pullDocuments()` — l'écran
 * (cf. app/horse/[id]/budget.tsx) affiche "reçu non disponible" en croisant localement
 * `documentId` avec la liste de documents déjà chargée par l'utilisateur
 * courant, sans appel réseau supplémentaire ni fuite. */
export async function pullExpenses(): Promise<Expense[] | null> {
  const { data, error } = await supabase
    .from("expenses")
    .select("id, horseId, amount, currency, category, date, notes, appointmentId, documentId, isPaid");
  if (error || !data) return null;
  return data.map((row) => ({
    id: row.id,
    horseId: row.horseId,
    amount: Number(row.amount),
    currency: row.currency,
    category: expenseCategoryFromDb(row.category),
    date: parseServerDate(row.date),
    notes: row.notes,
    appointmentId: row.appointmentId ?? null,
    documentId: row.documentId ?? null,
    isPaid: row.isPaid ?? false,
  }));
}

// Écritures suivies (cf. lib/remoteIndex.ts) : tant qu'une écriture est en
// vol, une relecture du serveur ne doit pas écraser la version locale qu'elle
// envoie. Chaque fonction exportée enveloppe son implémentation `…Impl`.
