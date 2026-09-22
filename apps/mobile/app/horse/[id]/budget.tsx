import { useMemo } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { Locked } from "@/components/Locked";
import { colors } from "@/theme/colors";
import { useHorses } from "@/horses/store";
import { useSubscription } from "@/subscription/store";
import { useAgenda, type Appointment, type Expense, type ExpenseCategory } from "@/agenda/store";
import {
  EXPENSE_META,
  capitalize,
  formatAmount,
  suggestedAppointmentFor as findSuggestedAppointment,
} from "@/agenda/meta";
import { ExpenseForm } from "@/agenda/components/ExpenseForm";
import { ExpenseCard } from "@/agenda/components/ExpenseCard";
import { useExpenseForm } from "@/agenda/hooks/useExpenseForm";

const CARD = "rounded-card bg-surface p-5 shadow-card";

/**
 * Budget d'UN cheval — « combien me coûte réellement mon cheval ? ». Reprend
 * la section « finances » de l'ancien écran Agenda sans rien changer aux
 * calculs : totaux payé/à régler, mois et année en cours, répartition par
 * catégorie, historique des six derniers mois, et la liste des dépenses.
 *
 * Vit ici pour la même raison que le coffre-fort de documents (cf.
 * app/horse/[id]/documents.tsx) : la fiche cheval annonçait déjà un module
 * « Budget » qui renvoyait vers un écran sorti de la barre d'onglets.
 */
export default function HorseBudgetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { horses } = useHorses();
  const { isActiveOrTrialing } = useSubscription();
  const {
    appointments,
    documents,
    expenses,
    addExpense,
    updateExpense,
    deleteExpense,
    toggleExpensePaid,
    addDocument,
    linkExpenseDocument,
  } = useAgenda();

  const horse = horses.find((h) => h.id === id);
  const horseId = horse?.id ?? null;

  // Mémoïsés (cf. audit perf du 2026-09-09, repris tel quel de l'écran
  // Agenda) : sans ça, taper dans le formulaire de dépense recalculait tout
  // le budget à chaque frappe.
  const sortedExpenses = useMemo(
    () => expenses.filter((e) => e.horseId === horseId).sort((a, b) => b.date.getTime() - a.date.getTime()),
    [expenses, horseId]
  );
  const horseAppointments = useMemo(
    () => appointments.filter((a) => a.horseId === horseId),
    [appointments, horseId]
  );

  // Toutes les dépenses sont en EUR (cf. Expense.currency) — un total
  // multi-devises n'aurait pas de sens sans conversion, hors scope.
  const totalExpenses = useMemo(() => sortedExpenses.reduce((sum, e) => sum + e.amount, 0), [sortedExpenses]);
  // Statut payé/à régler Premium (cf. Expense.isPaid) — en gratuit, tout
  // reste « à régler » faute de pouvoir basculer le statut.
  const paidExpenses = useMemo(
    () => sortedExpenses.filter((e) => e.isPaid).reduce((sum, e) => sum + e.amount, 0),
    [sortedExpenses]
  );
  const pendingExpenses = totalExpenses - paidExpenses;

  const now = useMemo(() => new Date(), []);
  const monthTotal = useMemo(
    () =>
      sortedExpenses
        .filter((e) => e.date.getFullYear() === now.getFullYear() && e.date.getMonth() === now.getMonth())
        .reduce((sum, e) => sum + e.amount, 0),
    [sortedExpenses, now]
  );
  const yearTotal = useMemo(
    () => sortedExpenses.filter((e) => e.date.getFullYear() === now.getFullYear()).reduce((sum, e) => sum + e.amount, 0),
    [sortedExpenses, now]
  );
  const categoryBreakdown = useMemo(
    () =>
      (Object.keys(EXPENSE_META) as ExpenseCategory[])
        .map((category) => ({
          category,
          total: sortedExpenses.filter((e) => e.category === category).reduce((sum, e) => sum + e.amount, 0),
        }))
        .filter((c) => c.total > 0)
        .sort((a, b) => b.total - a.total),
    [sortedExpenses]
  );
  // 6 derniers mois (mois courant inclus), le plus récent en premier — pas de
  // graphique, juste une liste lisible (cf. principe « présentation simple »).
  const monthlyHistory = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const total = sortedExpenses
          .filter((e) => e.date.getFullYear() === d.getFullYear() && e.date.getMonth() === d.getMonth())
          .reduce((sum, e) => sum + e.amount, 0);
        return {
          key: `${d.getFullYear()}-${d.getMonth()}`,
          label: capitalize(d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })),
          total,
        };
      }),
    [sortedExpenses, now]
  );

  const {
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
  } = useExpenseForm({
    addExpense,
    updateExpense,
    addDocument,
    linkExpenseDocument,
    isActiveOrTrialing,
    // Écran cadré sur un cheval précis, qui ne change pas le cheval actif :
    // la dépense doit viser CE cheval explicitement. Pas de
    // `selectableHorses` : proposer d'en viser un autre depuis le budget
    // d'un cheval n'aurait pas de sens (même règle que la fiche santé).
    horse: horse ?? null,
  });

  if (!horse) {
    return (
      <Screen>
        <FadeInView>
          <View className={`${CARD} items-center gap-2`}>
            <MaterialCommunityIcons name="horse-variant" size={28} color={colors.textMuted} />
            <Text className="text-sm text-muted">Ce cheval est introuvable.</Text>
          </View>
        </FadeInView>
      </Screen>
    );
  }

  /** Rapprochement proposé à la saisie : le rendez-vous le plus récent du
   * même type pour CE cheval. Jamais lié automatiquement — l'utilisateur
   * choisit (cf. ExpenseForm). */
  function suggestedAppointmentFor(category: ExpenseCategory): Appointment | null {
    return findSuggestedAppointment(horseAppointments, category);
  }

  function confirmDeleteExpense(expense: Expense) {
    Alert.alert("Supprimer cette dépense ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => deleteExpense(expense.id) },
    ]);
  }

  return (
    <>
      <Screen>
        <FadeInView>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 gap-0.5 pr-3">
              <Text className="text-2xl font-display tracking-tight text-text">Budget</Text>
              <Text className="text-sm text-muted">Dépenses et budget de {horse.name}</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={12}
              accessibilityLabel="Fermer"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </FadeInView>

        {sortedExpenses.length > 0 ? (
          <>
            <FadeInView delay={40}>
              <Locked message="Détail payé/à régler réservé à l'abonnement Premium">
                <View className={`${CARD} flex-row items-center justify-between`}>
                  <View className="items-center gap-0.5">
                    <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Total</Text>
                    <Text className="text-lg font-display text-text">{formatAmount(totalExpenses, "EUR")}</Text>
                  </View>
                  <View className="items-center gap-0.5">
                    <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Payé</Text>
                    <Text className="text-lg font-display text-success">{formatAmount(paidExpenses, "EUR")}</Text>
                  </View>
                  <View className="items-center gap-0.5">
                    <Text className="text-xs font-semibold uppercase tracking-wide text-muted">À payer</Text>
                    <Text className="text-lg font-display text-danger">{formatAmount(pendingExpenses, "EUR")}</Text>
                  </View>
                </View>
              </Locked>
            </FadeInView>

            <FadeInView delay={60}>
              <Locked message="Répartition du budget réservée à l'abonnement Premium">
                <View className={`${CARD} gap-4`}>
                  <View className="flex-row items-center justify-between">
                    <View className="gap-0.5">
                      <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Ce mois-ci</Text>
                      <Text className="text-lg font-display text-text">{formatAmount(monthTotal, "EUR")}</Text>
                    </View>
                    <View className="items-end gap-0.5">
                      <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Cette année</Text>
                      <Text className="text-lg font-display text-text">{formatAmount(yearTotal, "EUR")}</Text>
                    </View>
                  </View>

                  {categoryBreakdown.length > 0 ? (
                    <View className="gap-2 border-t border-border pt-3">
                      <Text className="text-xs font-bold uppercase tracking-wide text-accent">Par catégorie</Text>
                      {categoryBreakdown.map(({ category, total }) => {
                        const meta = EXPENSE_META[category];
                        const pct = totalExpenses > 0 ? Math.round((total / totalExpenses) * 100) : 0;
                        return (
                          <View key={category} className="flex-row items-center gap-2.5">
                            <View className={`h-8 w-8 items-center justify-center rounded-full ${meta.chip}`}>
                              <MaterialCommunityIcons name={meta.icon.name} size={15} color={meta.icon.color} />
                            </View>
                            <Text className="flex-1 text-sm text-text">{meta.label}</Text>
                            <Text className="text-xs text-muted">{pct}%</Text>
                            <Text className="w-20 text-right text-sm font-bold text-text">
                              {formatAmount(total, "EUR")}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}

                  <View className="gap-2 border-t border-border pt-3">
                    <Text className="text-xs font-bold uppercase tracking-wide text-accent">Historique mensuel</Text>
                    {monthlyHistory.map(({ key, label, total }) => (
                      <View key={key} className="flex-row items-center justify-between">
                        <Text className="text-sm text-muted">{label}</Text>
                        <Text className="text-sm font-semibold text-text">{formatAmount(total, "EUR")}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </Locked>
            </FadeInView>
          </>
        ) : null}

        <FadeInView delay={80}>
          <ExpenseForm
            show={showExpenseForm}
            form={expenseForm}
            setForm={setExpenseForm}
            editingExpenseId={editingExpenseId}
            suggestedAppointmentFor={suggestedAppointmentFor}
            targetHorseName={horse.name}
            onOpen={() => setShowExpenseForm(true)}
            onCancel={cancelExpenseForm}
            onSubmit={handleSubmitExpense}
            onPickPhoto={handlePickExpensePhoto}
          />
        </FadeInView>

        {sortedExpenses.length === 0 ? (
          <FadeInView delay={120}>
            <View className={`${CARD} items-center gap-2`}>
              <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
                <MaterialCommunityIcons name="wallet-outline" size={22} color={colors.textMuted} />
              </View>
              <Text className="text-center text-sm text-muted">
                Aucune dépense pour l&apos;instant. Pension, maréchal, véto : les noter ici permet de voir ce que coûte
                vraiment un mois.
              </Text>
              {!showExpenseForm ? (
                <TouchableOpacity onPress={() => setShowExpenseForm(true)} activeOpacity={0.7}>
                  <Text className="text-sm font-semibold text-accent">Ajouter une dépense</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </FadeInView>
        ) : (
          sortedExpenses.map((expense, i) => (
            <FadeInView key={expense.id} delay={120 + i * 60}>
              <ExpenseCard
                expense={expense}
                linkedAppointment={horseAppointments.find((a) => a.id === expense.appointmentId) ?? null}
                linkedDocument={documents.find((d) => d.id === expense.documentId) ?? null}
                onDelete={() => confirmDeleteExpense(expense)}
                onEdit={() => startEditExpense(expense)}
                onTogglePaid={() => toggleExpensePaid(expense.id)}
                onAttachReceipt={() => handleAttachReceipt(expense)}
                onRemoveReceipt={() => linkExpenseDocument(expense.id, null)}
              />
            </FadeInView>
          ))
        )}
      </Screen>
      <PickerOverlaySlot />
    </>
  );
}
