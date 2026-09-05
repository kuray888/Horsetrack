import { useState } from "react";
import { formatDate } from "@/lib/dateFormat";
import { pickAndPersistImage } from "@/lib/imagePicker";
import { daysFromNow, useAgenda, type Expense, type ExpenseCategory } from "@/agenda/store";
import { EXPENSE_META } from "@/agenda/meta";

const emptyExpenseForm = {
  category: "veto" as ExpenseCategory,
  amount: "",
  date: daysFromNow(0) as Date | null,
  notes: "",
  appointmentId: null as string | null,
  /** Photo de facture prise/choisie avant soumission — devient un Document
   * du coffre-fort (catégorie facture) au moment de l'ajout, cf.
   * handleSubmitExpense. Fonctionnalité Premium comme le reste du coffre-fort. */
  fileUri: null as string | null,
};

export type ExpenseFormValue = typeof emptyExpenseForm;

type AgendaActions = ReturnType<typeof useAgenda>;

/** État + logique du formulaire de dépense (création/édition) d'AgendaScreen,
 * plus l'ajout de reçu a posteriori sur une dépense existante
 * (`handleAttachReceipt`, partage la même logique "photo → Document du
 * coffre-fort" que la soumission du formulaire) — extrait tel quel, aucun
 * changement de comportement (cf. plan Phase 3 Étape 1). Pas de callback
 * `onEditStart` ici : contrairement aux autres cartes, ExpenseCard gère son
 * `expanded` en state local, jamais levé dans AgendaScreen. */
export function useExpenseForm({
  addExpense,
  updateExpense,
  addDocument,
  linkExpenseDocument,
  isActiveOrTrialing,
}: {
  addExpense: AgendaActions["addExpense"];
  updateExpense: AgendaActions["updateExpense"];
  addDocument: AgendaActions["addDocument"];
  linkExpenseDocument: AgendaActions["linkExpenseDocument"];
  isActiveOrTrialing: boolean;
}) {
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  function startEditExpense(expense: Expense) {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      category: expense.category,
      amount: String(expense.amount).replace(".", ","),
      date: expense.date,
      notes: expense.notes,
      appointmentId: expense.appointmentId,
      // Le reçu joint a déjà son propre contrôle dédié sur la carte
      // (onAttachReceipt/onRemoveReceipt) — l'édition générale ne le touche
      // pas (cf. updateExpense, dont le patch exclut documentId).
      fileUri: null,
    });
    setShowExpenseForm(true);
  }

  function cancelExpenseForm() {
    setShowExpenseForm(false);
    setEditingExpenseId(null);
    setExpenseForm(emptyExpenseForm);
  }

  function handleSubmitExpense() {
    const date = expenseForm.date;
    const amount = Number(expenseForm.amount.replace(",", "."));
    if (!date || !expenseForm.amount.trim() || !Number.isFinite(amount) || amount <= 0) return;

    if (editingExpenseId) {
      updateExpense(editingExpenseId, {
        amount,
        currency: "EUR",
        category: expenseForm.category,
        date,
        notes: expenseForm.notes.trim(),
        appointmentId: expenseForm.appointmentId,
      });
    } else {
      // La facture jointe devient un document du coffre-fort (catégorie
      // "facture"), lié à la dépense — seulement si Premium (coffre-fort
      // gaté, cf. Locked sur le bouton "Joindre une facture" plus bas) et si
      // une photo a effectivement été prise.
      const documentId =
        isActiveOrTrialing && expenseForm.fileUri
          ? addDocument({
              category: "facture",
              name: `Facture ${EXPENSE_META[expenseForm.category].label.toLowerCase()} — ${formatDate(date)}`,
              date,
              fileUri: expenseForm.fileUri,
            })
          : null;
      addExpense({
        amount,
        currency: "EUR",
        category: expenseForm.category,
        date,
        notes: expenseForm.notes.trim(),
        appointmentId: expenseForm.appointmentId,
        documentId,
        // Le statut payé/à régler se règle après coup depuis la liste (cf.
        // toggle Premium sur chaque dépense) — une dépense vient d'être créée,
        // elle est donc "à régler" par défaut.
        isPaid: false,
      });
    }
    cancelExpenseForm();
  }

  async function handlePickExpensePhoto() {
    const uri = await pickAndPersistImage();
    if (uri) setExpenseForm((f) => ({ ...f, fileUri: uri }));
  }

  /** Joint une facture à une dépense déjà créée (contrairement à
   * handleSubmitExpense, qui le fait à la création) — même principe : nouveau
   * document du coffre-fort, puis lien via linkExpenseDocument. */
  async function handleAttachReceipt(expense: Expense) {
    const uri = await pickAndPersistImage();
    if (!uri) return;
    const documentId = addDocument({
      category: "facture",
      name: `Facture ${EXPENSE_META[expense.category].label.toLowerCase()} — ${formatDate(expense.date)}`,
      date: expense.date,
      fileUri: uri,
    });
    linkExpenseDocument(expense.id, documentId);
  }

  return {
    showExpenseForm,
    setShowExpenseForm,
    expenseForm,
    setExpenseForm,
    editingExpenseId,
    startEditExpense,
    cancelExpenseForm,
    handleSubmitExpense,
    handlePickExpensePhoto,
    handleAttachReceipt,
  };
}
