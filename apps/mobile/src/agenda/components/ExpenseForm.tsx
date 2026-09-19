import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import { formatDate } from "@/lib/dateFormat";
import { Field } from "@/components/Field";
import { DatePickerField } from "@/components/DatePickerField";
import { PrimaryButton } from "@/components/onboarding";
import { ChipSelect, AddToggle } from "@/components/FormChips";
import { Locked } from "@/components/Locked";
import { AttachmentPreview } from "@/agenda/components/AttachmentPreview";
import { HorseMultiSelect } from "@/horses/components/HorseMultiSelect";
import { resolveTargetHorseIds, shouldOfferHorseChoice } from "@/horses/selectableHorses";
import type { Appointment, ExpenseCategory } from "@/agenda/store";
import { EXPENSE_META } from "@/agenda/meta";
import { amountsForHorses, type AmountMode } from "@/agenda/splitAmount";
import type { ExpenseFormValue } from "@/agenda/hooks/useExpenseForm";

/** Montant en euros pour l'aperçu de répartition — virgule décimale, et les
 * centimes seulement quand il y en a (60 € et non 60,00 €). */
function formatAmount(value: number): string {
  return (Math.round(value * 100) % 100 === 0 ? String(Math.round(value)) : value.toFixed(2)).replace(".", ",");
}

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

/** Formulaire de dépense (création/édition) d'AgendaScreen — JSX extrait tel
 * quel (cf. plan Phase 3 Étape 1), aucun changement de comportement.
 * `suggestedAppointmentFor` reste une prop (calculée dans AgendaScreen à
 * partir de `horseAppointments`, pas de l'état du formulaire lui-même). */
export function ExpenseForm({
  show,
  form,
  setForm,
  editingExpenseId,
  suggestedAppointmentFor,
  selectableHorses = [],
  activeHorseId = null,
  onOpen,
  onCancel,
  onSubmit,
  onPickPhoto,
}: {
  show: boolean;
  form: ExpenseFormValue;
  setForm: (updater: (f: ExpenseFormValue) => ExpenseFormValue) => void;
  editingExpenseId: string | null;
  suggestedAppointmentFor: (category: ExpenseCategory) => Appointment | null;
  /** Cf. AppointmentForm, même rôle et même provenance (useSelectableHorses). */
  selectableHorses?: { id: string; name: string }[];
  activeHorseId?: string | null;
  onOpen: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  onPickPhoto: () => void;
}) {
  if (!show) {
    return <AddToggle label="Ajouter une dépense" onPress={onOpen} color={colors.primary} />;
  }

  const offerHorseChoice = !editingExpenseId && shouldOfferHorseChoice(selectableHorses);
  const targetCount = offerHorseChoice
    ? resolveTargetHorseIds(form.horseIds, selectableHorses, activeHorseId).length
    : 1;
  const parsedAmount = Number(form.amount.replace(",", "."));
  // Aperçu de ce que la soumission va créer, calculé avec la MÊME fonction
  // que handleSubmitExpense : le montant à répartir est le seul endroit de
  // l'app où l'utilisateur ne peut pas deviner le résultat de tête (100 € sur
  // 3 chevaux ne fait pas trois fois 33,33 €), il faut donc le lui montrer
  // avant qu'il valide, pas après.
  const previewAmounts =
    targetCount > 1 && Number.isFinite(parsedAmount) && parsedAmount > 0
      ? amountsForHorses(parsedAmount, targetCount, form.amountMode)
      : null;

  return (
    <View className={`${CARD} gap-3`}>
      <Text className="text-sm font-bold uppercase tracking-wide text-accent">
        {editingExpenseId ? "Modifier la dépense" : "Nouvelle dépense"}
      </Text>
      <Field label="Catégorie">
        <ChipSelect
          options={Object.entries(EXPENSE_META).map(([value, meta]) => ({
            value: value as ExpenseCategory,
            label: meta.label,
            icon: meta.icon,
          }))}
          value={form.category}
          onChange={(category) => setForm((f) => ({ ...f, category, appointmentId: null }))}
        />
      </Field>
      {offerHorseChoice ? (
        <HorseMultiSelect
          horses={selectableHorses}
          activeHorseId={activeHorseId}
          value={form.horseIds}
          onChange={(horseIds) => setForm((f) => ({ ...f, horseIds }))}
        />
      ) : null}
      <Field label="Montant (€)">
        <TextInput
          className={INPUT}
          placeholder="Ex : 45"
          value={form.amount}
          onChangeText={(amount) => setForm((f) => ({ ...f, amount }))}
          keyboardType="decimal-pad"
        />
      </Field>
      {/* Deux lectures possibles d'un même montant dès qu'il y a plusieurs
          chevaux, et aucune n'est évidente : 300 € de pension valent POUR
          CHACUN, 180 € de déplacement de maréchal sont À RÉPARTIR. On demande
          plutôt que de deviner (décision produit du 2026-09-19). */}
      {targetCount > 1 ? (
        <Field label="Ce montant est…">
          <View className="gap-2">
            <ChipSelect
              options={[
                { value: "per-horse" as AmountMode, label: "Par cheval", icon: { name: "content-copy", color: colors.textMuted } },
                { value: "split" as AmountMode, label: "À répartir", icon: { name: "call-split", color: colors.textMuted } },
              ]}
              value={form.amountMode}
              onChange={(amountMode) => setForm((f) => ({ ...f, amountMode }))}
            />
            {previewAmounts ? (
              <Text className="text-xs text-muted">
                {form.amountMode === "split"
                  ? `${targetCount} dépenses de ${previewAmounts.map(formatAmount).join(" / ")} €, soit ${formatAmount(parsedAmount)} € au total.`
                  : `${targetCount} dépenses de ${formatAmount(parsedAmount)} €, soit ${formatAmount(parsedAmount * targetCount)} € au total.`}
              </Text>
            ) : null}
          </View>
        </Field>
      ) : null}
      <DatePickerField label="Date" value={form.date} onChange={(date) => setForm((f) => ({ ...f, date }))} />
      <View className="gap-1.5">
        <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Notes (optionnel)</Text>
        <TextInput
          className={INPUT}
          placeholder="Ex : Vermifuge d'automne"
          value={form.notes}
          onChangeText={(notes) => setForm((f) => ({ ...f, notes }))}
        />
      </View>
      {(() => {
        // Un rendez-vous n'appartient qu'à un cheval : le rapprochement n'a
        // plus de sens dès que la dépense en vise plusieurs (cf.
        // handleSubmitExpense, qui écarte alors `appointmentId`).
        if (targetCount > 1) return null;
        const suggestion = suggestedAppointmentFor(form.category);
        if (!suggestion) return null;
        const linked = form.appointmentId === suggestion.id;
        return (
          <TouchableOpacity
            onPress={() => setForm((f) => ({ ...f, appointmentId: linked ? null : suggestion.id }))}
            activeOpacity={0.8}
            className={`flex-row items-center gap-2 rounded-card border p-3 ${
              linked ? "border-primary bg-highlight" : "border-dashed border-border"
            }`}
          >
            <MaterialCommunityIcons
              name={linked ? "check-circle-outline" : "link-variant"}
              size={18}
              color={linked ? colors.primary : colors.textMuted}
            />
            <Text className="flex-1 text-sm text-text">
              {linked ? "Lié à " : "Lier à "}
              <Text className="font-semibold">{suggestion.title}</Text> ({formatDate(suggestion.date)})
            </Text>
          </TouchableOpacity>
        );
      })()}
      {editingExpenseId ? (
        <Text className="text-xs text-muted">
          Le reçu joint se gère depuis la fiche de la dépense, pas depuis ce formulaire.
        </Text>
      ) : (
        <Locked message="Joindre une facture réservé à l'abonnement Premium (coffre-fort)">
          {form.fileUri ? (
            <TouchableOpacity onPress={onPickPhoto} activeOpacity={0.8} className="gap-2">
              <AttachmentPreview uri={form.fileUri} height={128} />
              <Text className="text-center text-sm font-semibold text-accent">Changer la facture</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={onPickPhoto}
              activeOpacity={0.8}
              className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-border p-4"
            >
              <MaterialCommunityIcons name="paperclip" size={17} color={colors.textMuted} />
              <Text className="text-sm font-semibold text-muted">Joindre une facture (photos ou PDF)</Text>
            </TouchableOpacity>
          )}
        </Locked>
      )}
      <View className="flex-row gap-2">
        <TouchableOpacity onPress={onCancel} className="flex-1 items-center rounded-card border border-border p-4">
          <Text className="text-base font-semibold text-muted">Annuler</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <PrimaryButton
            label={editingExpenseId ? "Enregistrer" : targetCount > 1 ? `Ajouter (×${targetCount})` : "Ajouter"}
            disabled={!form.amount.trim() || !form.date || !(Number(form.amount.replace(",", ".")) > 0)}
            onPress={onSubmit}
          />
        </View>
      </View>
    </View>
  );
}
