import { useState } from "react";
import { formatDate } from "@/lib/dateFormat";
import { chooseAndPickDocument } from "@/lib/imagePicker";
import { daysFromNow, useAgenda, type Expense, type ExpenseCategory } from "@/agenda/store";
import { EXPENSE_META } from "@/agenda/meta";
import { amountsForHorses, type AmountMode } from "@/agenda/splitAmount";
import { resolveTargetHorseIds } from "@/horses/selectableHorses";
import type { Horse } from "@/horses/store";

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
  /** Chevaux visés — vide = « aucun choix explicite », donc le cheval actif
   * seul (cf. resolveTargetHorseIds, même convention que le formulaire de
   * rendez-vous). */
  horseIds: [] as string[],
  /** Comment lire le montant quand plusieurs chevaux sont cochés — sans
   * effet sur un seul (cf. amountsForHorses). Par cheval par défaut : c'est
   * le cas le plus fréquent (pension, vaccin facturé à l'unité), et c'est le
   * mode qui ne divise rien sans qu'on l'ait demandé. */
  amountMode: "per-horse" as AmountMode,
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
  horse = null,
  selectableHorses = [],
}: {
  addExpense: AgendaActions["addExpense"];
  updateExpense: AgendaActions["updateExpense"];
  addDocument: AgendaActions["addDocument"];
  linkExpenseDocument: AgendaActions["linkExpenseDocument"];
  isActiveOrTrialing: boolean;
  /** Cheval visé par défaut. Omis par les écrans qui laissent `addExpense`
   * retomber tout seul sur le cheval actif — comportement d'origine. */
  horse?: Horse | null;
  /** Chevaux proposables pour créer la même dépense d'un coup (cf.
   * useSelectableHorses). Vide = pas de sélecteur, rien ne change. */
  selectableHorses?: Horse[];
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
      // Le sélecteur de chevaux est masqué en édition : on ne réaffecte
      // jamais une dépense existante, et son montant ne se re-répartit pas.
      horseIds: [],
      amountMode: "per-horse",
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
      // Une dépense par cheval visé, chacune indépendante (même invariant que
      // les rendez-vous : aucune notion de série côté modèle). Le reçu, lui,
      // reste UN seul document du coffre-fort partagé par les N dépenses :
      // c'est une seule facture, la rescanner par cheval n'aurait pas de sens
      // (Expense.documentId n'est pas unique, cf. schema.prisma).
      const targetHorseIds = resolveTargetHorseIds(
        expenseForm.horseIds,
        selectableHorses,
        horse?.id ?? null
      );
      const amounts = amountsForHorses(amount, Math.max(1, targetHorseIds.length), expenseForm.amountMode);
      // Un rendez-vous n'appartient qu'à un cheval : le lien de rapprochement
      // ne peut pas suivre sur les dépenses des autres. Plutôt que de le
      // rattacher de travers, on le laisse tomber dès qu'il y a plusieurs
      // chevaux — le formulaire masque d'ailleurs le champ dans ce cas.
      const appointmentId = targetHorseIds.length > 1 ? null : expenseForm.appointmentId;
      const targets = targetHorseIds.length > 0 ? targetHorseIds : [undefined];
      targets.forEach((targetHorseId, i) => {
        addExpense({
          ...(targetHorseId === undefined ? {} : { horseId: targetHorseId }),
          amount: amounts[i] ?? amount,
          currency: "EUR",
          category: expenseForm.category,
          date,
          notes: expenseForm.notes.trim(),
          appointmentId,
          documentId,
          // Le statut payé/à régler se règle après coup depuis la liste (cf.
          // toggle Premium sur chaque dépense) — une dépense vient d'être créée,
          // elle est donc "à régler" par défaut.
          isPaid: false,
        });
      });
    }
    cancelExpenseForm();
  }

  async function handlePickExpensePhoto() {
    const uri = await chooseAndPickDocument();
    if (uri) setExpenseForm((f) => ({ ...f, fileUri: uri }));
  }

  /** Joint une facture à une dépense déjà créée (contrairement à
   * handleSubmitExpense, qui le fait à la création) — même principe : nouveau
   * document du coffre-fort, puis lien via linkExpenseDocument. */
  async function handleAttachReceipt(expense: Expense) {
    const uri = await chooseAndPickDocument();
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
