import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { colors } from "@/theme/colors";
import { Field } from "@/components/Field";
import { DatePickerField } from "@/components/DatePickerField";
import { TimePickerField } from "@/components/TimePickerField";
import { PrimaryButton } from "@/components/onboarding";
import { ChipSelect, AddToggle } from "@/components/FormChips";
import { Locked } from "@/components/Locked";
import { RecurrenceField } from "@/components/RecurrenceField";
import { computeRecurrenceDates } from "@/lib/recurrence";
import type { ReminderOption } from "@/lib/notifications";
import type { AppointmentType, CompetitionEntry } from "@/agenda/store";
import { APPT_META, HEALTH_APPT_TYPES, REMINDER_META, DISCIPLINE_META } from "@/agenda/meta";
import type { AppointmentFormValue } from "@/agenda/hooks/useAppointmentForm";
import type { Discipline } from "@/onboarding/store";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

/** Formulaire de rendez-vous (création/édition) d'AgendaScreen — JSX extrait
 * tel quel (cf. plan Phase 3 Étape 1), aucun changement de comportement.
 * Bascule elle-même entre le bouton "Ajouter" et le formulaire ouvert, comme
 * le faisait le ternaire d'origine dans AgendaScreen. */
export function AppointmentForm({
  show,
  form,
  setForm,
  editingApptId,
  submitting,
  onOpen,
  onCancel,
  onSubmit,
  onAddEntry,
  onUpdateEntry,
  onRemoveEntry,
}: {
  show: boolean;
  form: AppointmentFormValue;
  setForm: (updater: (f: AppointmentFormValue) => AppointmentFormValue) => void;
  editingApptId: string | null;
  submitting: boolean;
  onOpen: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  onAddEntry: () => void;
  onUpdateEntry: (id: string, patch: Partial<CompetitionEntry>) => void;
  onRemoveEntry: (id: string) => void;
}) {
  if (!show) {
    return <AddToggle label="Ajouter un rendez-vous" onPress={onOpen} color={colors.primary} />;
  }

  return (
    <View className={`${CARD} gap-3`}>
      <Text className="text-sm font-bold uppercase tracking-wide text-accent">
        {editingApptId ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}
      </Text>
      <Field label="Type de rendez-vous">
        <ChipSelect
          options={Object.entries(APPT_META).map(([value, meta]) => ({
            value: value as AppointmentType,
            label: meta.label,
            icon: meta.icon,
          }))}
          value={form.type}
          onChange={(type) => setForm((f) => ({ ...f, type }))}
        />
      </Field>
      <Field label="Titre">
        <TextInput
          className={INPUT}
          placeholder="Ex : Vaccin annuel"
          value={form.title}
          onChangeText={(title) => setForm((f) => ({ ...f, title }))}
        />
      </Field>
      <DatePickerField label="Date" value={form.date} onChange={(date) => setForm((f) => ({ ...f, date }))} />
      <TimePickerField label="Heure" value={form.time} onChange={(time) => setForm((f) => ({ ...f, time }))} />
      <Field label="Lieu (optionnel)">
        <TextInput
          className={INPUT}
          placeholder="Ex : Clinique équine du Val"
          value={form.location}
          onChangeText={(location) => setForm((f) => ({ ...f, location }))}
        />
      </Field>
      {HEALTH_APPT_TYPES.includes(form.type) ? (
        <>
          <Field label="Professionnel (optionnel)">
            <TextInput
              className={INPUT}
              placeholder="Ex : Dr Martin"
              value={form.professional}
              onChangeText={(professional) => setForm((f) => ({ ...f, professional }))}
            />
          </Field>
          <Field label="Coût (€, optionnel)">
            <TextInput
              className={INPUT}
              placeholder="Ex : 65"
              value={form.cost}
              onChangeText={(cost) => setForm((f) => ({ ...f, cost }))}
              keyboardType="decimal-pad"
            />
          </Field>
          <DatePickerField
            label="Prochaine échéance (optionnel)"
            value={form.nextDueDate}
            onChange={(nextDueDate) => setForm((f) => ({ ...f, nextDueDate }))}
          />
        </>
      ) : null}
      <Locked message="Rappels automatiques réservés à l'abonnement Premium">
        <Field label="Rappel">
          <ChipSelect
            options={Object.entries(REMINDER_META).map(([value, meta]) => ({
              value: value as ReminderOption,
              label: meta.label,
              icon: meta.icon,
            }))}
            value={form.reminder}
            onChange={(reminder) => setForm((f) => ({ ...f, reminder }))}
          />
        </Field>
      </Locked>
      {!editingApptId && form.type !== "concours" ? (
        <RecurrenceField value={form.recurrence} onChange={(recurrence) => setForm((f) => ({ ...f, recurrence }))} />
      ) : null}
      {form.type === "concours" ? (
        <>
          <Field label="Dossard (optionnel)">
            <TextInput
              className={INPUT}
              placeholder="Ex : 142"
              value={form.dossard}
              onChangeText={(dossard) => setForm((f) => ({ ...f, dossard }))}
              keyboardType="number-pad"
            />
          </Field>
          <Locked message="Plusieurs épreuves par concours réservé à l'abonnement Premium">
            <View className="gap-2">
              <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Épreuves</Text>
              {form.competitionEntries.map((entry) => (
                <View key={entry.id} className="gap-2 rounded-card border border-border p-3">
                  <View className="flex-row items-center gap-2">
                    <TextInput
                      className={`${INPUT} flex-1`}
                      placeholder="Ex : Épreuve club 2 — 1m10"
                      value={entry.name}
                      onChangeText={(name) => onUpdateEntry(entry.id, { name })}
                    />
                    <TouchableOpacity onPress={() => onRemoveEntry(entry.id)} hitSlop={8} activeOpacity={0.7}>
                      <Text className="text-sm text-muted">✕</Text>
                    </TouchableOpacity>
                  </View>
                  <ChipSelect
                    options={Object.entries(DISCIPLINE_META).map(([value, meta]) => ({
                      value: value as Discipline,
                      label: meta.label,
                      icon: meta.icon,
                    }))}
                    value={entry.discipline}
                    onChange={(discipline) => onUpdateEntry(entry.id, { discipline })}
                  />
                  <TextInput
                    className={INPUT}
                    placeholder="Heure de l'épreuve (ex : 09h15)"
                    value={entry.time}
                    onChangeText={(time) => onUpdateEntry(entry.id, { time })}
                  />
                </View>
              ))}
              <TouchableOpacity
                onPress={onAddEntry}
                activeOpacity={0.8}
                className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-border p-3"
              >
                <Text className="text-sm font-semibold text-accent">＋ Ajouter une épreuve</Text>
              </TouchableOpacity>
            </View>
          </Locked>
        </>
      ) : null}
      <View className="flex-row gap-2">
        <TouchableOpacity onPress={onCancel} className="flex-1 items-center rounded-card border border-border p-4">
          <Text className="text-base font-semibold text-muted">Annuler</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <PrimaryButton
            label={
              submitting
                ? "Un instant…"
                : editingApptId
                  ? "Enregistrer"
                  : form.recurrence.mode === "custom" &&
                      form.date &&
                      computeRecurrenceDates(form.date, form.recurrence).length > 1
                    ? `Ajouter (×${computeRecurrenceDates(form.date, form.recurrence).length})`
                    : "Ajouter"
            }
            disabled={!form.title.trim() || !form.date || submitting}
            onPress={onSubmit}
          />
        </View>
      </View>
    </View>
  );
}
