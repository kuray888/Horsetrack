import { Image, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import { Field } from "@/components/Field";
import { DatePickerField } from "@/components/DatePickerField";
import { TimePickerField } from "@/components/TimePickerField";
import { PrimaryButton } from "@/components/onboarding";
import { ChipSelect, AddToggle } from "@/components/FormChips";
import { Locked } from "@/components/Locked";
import { ACTIVITY_META, type ActivityType, type Mood } from "@/agenda/store";
import { MOOD_META } from "@/agenda/meta";
import type { JournalFormValue } from "@/agenda/hooks/useJournalForm";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

/** Formulaire de journal (création/édition) d'AgendaScreen — JSX extrait tel
 * quel (cf. plan Phase 3 Étape 1), aucun changement de comportement. */
export function JournalForm({
  show,
  form,
  setForm,
  editingJournalId,
  saving,
  onOpen,
  onCancel,
  onSubmit,
  onPickPhoto,
}: {
  show: boolean;
  form: JournalFormValue;
  setForm: (updater: (f: JournalFormValue) => JournalFormValue) => void;
  editingJournalId: string | null;
  saving: boolean;
  onOpen: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  onPickPhoto: () => void;
}) {
  if (!show) {
    return <AddToggle label="Ajouter une entrée de journal" onPress={onOpen} color={colors.primary} />;
  }

  return (
    <View className={`${CARD} gap-3`}>
      <Text className="text-sm font-bold uppercase tracking-wide text-accent">
        {editingJournalId ? "Modifier l'entrée de journal" : "Nouvelle entrée de journal"}
      </Text>
      <Field label="Activité">
        <ChipSelect
          options={Object.entries(ACTIVITY_META).map(([value, meta]) => ({
            value: value as ActivityType,
            label: meta.label,
            icon: { name: meta.icon, color: meta.tint },
          }))}
          value={form.activityType}
          onChange={(activityType) => setForm((f) => ({ ...f, activityType }))}
        />
      </Field>
      <Field label="Ressenti">
        <ChipSelect
          options={Object.entries(MOOD_META).map(([value, meta]) => ({
            value: value as Mood,
            label: meta.label,
            icon: meta.emoji,
          }))}
          value={form.mood}
          onChange={(mood) => setForm((f) => ({ ...f, mood }))}
        />
      </Field>
      <DatePickerField label="Date" value={form.date} onChange={(date) => setForm((f) => ({ ...f, date }))} />
      <TimePickerField label="Heure" value={form.time} onChange={(time) => setForm((f) => ({ ...f, time }))} />
      <Locked message="Photo du jour réservée à l'abonnement Premium">
        {form.photoUri ? (
          <TouchableOpacity onPress={onPickPhoto} activeOpacity={0.8} className="gap-2">
            <Image source={{ uri: form.photoUri }} className="h-40 w-full rounded-card" resizeMode="cover" />
            <Text className="text-center text-sm font-semibold text-accent">Changer la photo</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onPickPhoto}
            activeOpacity={0.8}
            className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-border p-4"
          >
            <MaterialCommunityIcons name="image-outline" size={17} color={colors.textMuted} />
            <Text className="text-sm font-semibold text-muted">Ajouter une photo du jour</Text>
          </TouchableOpacity>
        )}
      </Locked>
      <View className="gap-1.5">
        <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Notes (optionnel)</Text>
        <TextInput
          className={INPUT}
          placeholder="Ex : très bonne séance, cheval détendu"
          value={form.notes}
          onChangeText={(notes) => setForm((f) => ({ ...f, notes }))}
          multiline
        />
      </View>
      <View className="flex-row gap-2">
        <TouchableOpacity onPress={onCancel} className="flex-1 items-center rounded-card border border-border p-4">
          <Text className="text-base font-semibold text-muted">Annuler</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <PrimaryButton
            label={saving ? "Un instant…" : editingJournalId ? "Enregistrer" : "Ajouter"}
            disabled={!form.date || saving}
            onPress={onSubmit}
          />
        </View>
      </View>
    </View>
  );
}
