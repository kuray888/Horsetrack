import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { DropdownField } from "@/components/DropdownField";
import { DatePickerField } from "@/components/DatePickerField";
import { Field } from "@/components/Field";
import { INJURY_TYPES, OTHER_OPTION, RECOVERY_STATUSES } from "@/onboarding/options";
import { formatDate } from "@/lib/dateFormat";
import { colors } from "@/theme/colors";
import type { HorseRecoveryStatus } from "@/onboarding/store";

const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

export type InjuryEntry = {
  key: string;
  type: string;
  occurredAt: Date | null;
  recoveryStatus: HorseRecoveryStatus | null;
  note: string;
};

function recoveryLabel(status: HorseRecoveryStatus | null): string {
  return RECOVERY_STATUSES.find((s) => s.value === status)?.label ?? "—";
}

/**
 * Section autonome "Historique de blessures" : liste + mini-formulaire d'ajout
 * (type, date, état de récupération, note) — réutilisée par l'onboarding et
 * par l'ajout de cheval depuis le Profil, pour garder les deux parcours à parité.
 */
export function InjuryHistoryField({
  injuries,
  onAdd,
  onRemove,
}: {
  injuries: InjuryEntry[];
  onAdd: (entry: Omit<InjuryEntry, "key">) => void;
  onRemove: (key: string) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState<string | null>(null);
  const [customType, setCustomType] = useState("");
  const [occurredAt, setOccurredAt] = useState<Date | null>(null);
  const [recoveryStatus, setRecoveryStatus] = useState<HorseRecoveryStatus | null>(null);
  const [note, setNote] = useState("");

  const finalType = type === OTHER_OPTION ? customType.trim() : type ?? "";
  const canSave = finalType.length > 0 && recoveryStatus !== null;

  function resetForm() {
    setType(null);
    setCustomType("");
    setOccurredAt(null);
    setRecoveryStatus(null);
    setNote("");
    setFormOpen(false);
  }

  function saveInjury() {
    if (!canSave) return;
    onAdd({ type: finalType, occurredAt, recoveryStatus, note: note.trim() });
    resetForm();
  }

  return (
    <View className="gap-3">
      <Text className="text-sm font-semibold text-muted">Historique de blessures</Text>

      {injuries.map((injury) => (
        <View key={injury.key} className="gap-1 rounded-card border border-border bg-surface p-4">
          <View className="flex-row items-start justify-between">
            <Text className="flex-1 text-base font-bold text-text">{injury.type}</Text>
            <TouchableOpacity
              onPress={() => onRemove(injury.key)}
              hitSlop={8}
              accessibilityLabel={`Retirer ${injury.type}`}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="close" size={16} color={colors.danger} accessibilityElementsHidden />
            </TouchableOpacity>
          </View>
          <Text className="text-sm text-muted">
            {injury.occurredAt ? formatDate(injury.occurredAt) : "Date non précisée"} ·{" "}
            {recoveryLabel(injury.recoveryStatus)}
          </Text>
          {injury.note ? <Text className="text-sm text-text">{injury.note}</Text> : null}
        </View>
      ))}

      {formOpen ? (
        <View className="gap-4 rounded-card border border-dashed border-primary p-4">
          <DropdownField
            label="Type de blessure"
            options={INJURY_TYPES}
            value={type}
            onChange={setType}
            placeholder="Sélectionner un type"
          />
          {type === OTHER_OPTION ? (
            <TextInput
              className={INPUT}
              placeholder="Précise le type de blessure"
              value={customType}
              onChangeText={setCustomType}
            />
          ) : null}

          <DatePickerField label="Date approximative (optionnel)" value={occurredAt} onChange={setOccurredAt} />

          <DropdownField
            label="État de récupération"
            options={RECOVERY_STATUSES}
            value={recoveryStatus}
            onChange={setRecoveryStatus}
            placeholder="Sélectionner un état"
          />

          <Field label="Note (optionnel)">
            <TextInput
              className={INPUT}
              placeholder="Détails utiles à garder en tête"
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
          </Field>

          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={resetForm}
              activeOpacity={0.8}
              className="flex-1 items-center rounded-card border border-border p-3.5"
            >
              <Text className="text-sm font-semibold text-muted">Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={saveInjury}
              disabled={!canSave}
              activeOpacity={0.85}
              className={`flex-1 items-center rounded-card p-3.5 ${canSave ? "bg-primary" : "bg-border"}`}
            >
              <Text className={`text-sm font-bold ${canSave ? "text-on-primary" : "text-muted"}`}>
                Ajouter à l&apos;historique
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => setFormOpen(true)}
          activeOpacity={0.8}
          className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-primary p-4"
        >
          <MaterialCommunityIcons name="plus" size={18} color={colors.primary} />
          <Text className="text-base font-semibold text-primary">Ajouter une blessure passée</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
