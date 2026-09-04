import { Image, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import { formatDate } from "@/lib/dateFormat";
import { Field } from "@/components/Field";
import { DatePickerField } from "@/components/DatePickerField";
import { PrimaryButton } from "@/components/onboarding";
import { ChipSelect, AddToggle } from "@/components/FormChips";
import { Locked } from "@/components/Locked";
import type { Appointment, ExpenseCategory } from "@/agenda/store";
import { EXPENSE_META } from "@/agenda/meta";
import type { ExpenseFormValue } from "@/agenda/hooks/useExpenseForm";

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
  onOpen: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  onPickPhoto: () => void;
}) {
  if (!show) {
    return <AddToggle label="Ajouter une dépense" onPress={onOpen} color={colors.primary} />;
  }

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
      <Field label="Montant (€)">
        <TextInput
          className={INPUT}
          placeholder="Ex : 45"
          value={form.amount}
          onChangeText={(amount) => setForm((f) => ({ ...f, amount }))}
          keyboardType="decimal-pad"
        />
      </Field>
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
              <Image source={{ uri: form.fileUri }} className="h-32 w-full rounded-card" resizeMode="cover" />
              <Text className="text-center text-sm font-semibold text-accent">Changer la photo</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={onPickPhoto}
              activeOpacity={0.8}
              className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-border p-4"
            >
              <MaterialCommunityIcons name="paperclip" size={17} color={colors.textMuted} />
              <Text className="text-sm font-semibold text-muted">Joindre une facture</Text>
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
            label={editingExpenseId ? "Enregistrer" : "Ajouter"}
            disabled={!form.amount.trim() || !form.date}
            onPress={onSubmit}
          />
        </View>
      </View>
    </View>
  );
}
