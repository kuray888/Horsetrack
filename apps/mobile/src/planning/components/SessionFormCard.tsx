import { type Dispatch, type SetStateAction } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Field } from "@/components/Field";
import { DatePickerField } from "@/components/DatePickerField";
import { TimePickerField } from "@/components/TimePickerField";
import { RecurrenceField } from "@/components/RecurrenceField";
import { FormDetails } from "@/components/FormDetails";
import { PrimaryButton } from "@/components/onboarding";
import { ChipSelect } from "@/components/FormChips";
import { HorseMultiSelect } from "@/horses/components/HorseMultiSelect";
import { MAX_ENTRIES_PER_SUBMIT } from "@/horses/selectableHorses";
import { OTHER_OPTION } from "@/onboarding/options";
import { ACTIVITY_META } from "@/agenda/store";
import type { SessionIntensity } from "@/sessions/store";
import { INTENSITY_META } from "@/sessions/components/SessionCard";
import { useThemeColors } from "@/theme/ThemeProvider";
import { DURATION_OPTIONS, type SessionForm, type SessionTypeSelection } from "@/planning/sessionForm";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

/**
 * Formulaire de séance du Planning (création et modification) — sorti de
 * app/(tabs)/planning.tsx tel quel. Toute la logique (soumission, cible,
 * plafond) reste dans l'écran : ce composant ne fait qu'afficher l'état
 * reçu et remonter les gestes.
 */
export function SessionFormCard({
  form,
  setForm,
  editing,
  selectableHorses,
  defaultHorseIds,
  offerHorseChoice,
  onCompletePlanned,
  showDetails,
  onToggleDetails,
  detailsSummary,
  overLimit,
  createCount,
  missingHorseChoice,
  onCancel,
  onSubmit,
}: {
  form: SessionForm;
  setForm: Dispatch<SetStateAction<SessionForm>>;
  editing: boolean;
  selectableHorses: Parameters<typeof HorseMultiSelect>[0]["horses"];
  defaultHorseIds: string[];
  offerHorseChoice: boolean;
  /** Une séance déjà prévue ce jour-là : la marquer faite (null sinon). */
  onCompletePlanned: (() => void) | null;
  showDetails: boolean;
  onToggleDetails: () => void;
  detailsSummary: string;
  overLimit: boolean;
  createCount: number;
  missingHorseChoice: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const colors = useThemeColors();
  return (
    <View className={`${CARD} gap-3`}>
      <Text className="text-sm font-bold uppercase tracking-wide text-accent">
        {editing ? t("Modifier la séance") : form.completed ? t("Enregistrer une séance faite") : t("Planifier une séance")}
      </Text>
      {/* Planifier ou noter après coup : deux intentions distinctes pour
          un même modèle (cf. SessionForm.completed). En tête du
          formulaire, parce que le choix change ce que les champs
          suivants veulent dire (une date à venir ou un fait passé). */}
      {!editing ? (
        <Field label={t("Cette séance est…")}>
          <ChipSelect
            options={[
              { value: "planned", label: t("À planifier"), icon: { name: "calendar-clock" as const, color: colors.primary } },
              { value: "done", label: t("Déjà faite"), icon: { name: "check-circle-outline" as const, color: colors.success } },
            ]}
            value={form.completed ? "done" : "planned"}
            onChange={(v) => setForm((f) => ({ ...f, completed: v === "done" }))}
          />
        </Field>
      ) : null}
      <Field label={t("Type de séance")}>
        <ChipSelect
          options={[
            ...Object.entries(ACTIVITY_META).map(([value, meta]) => ({
              value: value as SessionTypeSelection,
              label: meta.label,
              icon: { name: meta.icon, color: meta.tint },
            })),
            { value: OTHER_OPTION, label: t("Autre"), icon: { name: "shape-outline" as const, color: colors.textMuted } },
          ]}
          value={form.typeSelection}
          onChange={(typeSelection) =>
            setForm((f) => ({
              ...f,
              typeSelection,
              // Standard → Autre : garde activityType tel quel (fallback
              // technique, cf. son commentaire sur TrainingSession).
              // Autre → standard : le type choisi devient activityType et
              // efface le texte personnalisé.
              activityType: typeSelection === OTHER_OPTION ? f.activityType : typeSelection,
              customActivityLabel: typeSelection === OTHER_OPTION ? f.customActivityLabel : "",
            }))
          }
        />
      </Field>
      {form.typeSelection === OTHER_OPTION ? (
        <Field label={t("Précisez votre séance")}>
          <TextInput
            className={INPUT}
            placeholder={t("Ex : Séance à la plage")}
            value={form.customActivityLabel}
            onChangeText={(customActivityLabel) => setForm((f) => ({ ...f, customActivityLabel }))}
          />
        </Field>
      ) : null}
      <DatePickerField label={t("Date")} value={form.date} onChange={(date) => setForm((f) => ({ ...f, date }))} />
      <Field label={t("Durée")}>
        <ChipSelect
          options={DURATION_OPTIONS.map((min) => ({
            value: String(min),
            label: t("{min} min", { min: min }),
            icon: { name: "timer-outline" as const, color: colors.textMuted },
          }))}
          value={String(form.durationMinutes)}
          onChange={(v) => setForm((f) => ({ ...f, durationMinutes: Number(v) }))}
        />
      </Field>
      {!editing && offerHorseChoice ? (
        <HorseMultiSelect
          horses={selectableHorses}
          fallbackIds={defaultHorseIds}
          value={form.horseIds}
          onChange={(horseIds) => setForm((f) => ({ ...f, horseIds }))}
        />
      ) : null}
      {/* Une séance déjà planifiée le même jour pour le même cheval :
          la marquer faite plutôt qu'en créer une seconde, qui ferait
          deux lignes pour une seule sortie (et fausserait les stats).
          Le formulaire reste ouvert si l'utilisateur préfère créer. */}
      {onCompletePlanned ? (
        <TouchableOpacity accessibilityRole="button"
          onPress={onCompletePlanned}
          activeOpacity={0.8}
          className="flex-row items-center gap-2 rounded-card border border-dashed border-primary p-3"
        >
          <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.primary} />
          <Text className="flex-1 text-sm text-text">
            {t("Une séance est déjà prévue ce jour-là —")}{" "}
            <Text className="font-semibold text-primary">{t("la marquer comme faite")}</Text> {t(" plutôt que d'en ajouter une deuxième.")}
          </Text>
        </TouchableOpacity>
      ) : null}
      {/* Détails facultatifs repliés — même composant que le formulaire
          de rendez-vous (cf. components/FormDetails.tsx). */}
      <FormDetails
        open={showDetails}
        onToggle={onToggleDetails}
        summary={detailsSummary}
      >
        <>
          <TimePickerField
            label={t("Heure (optionnel)")}
            value={form.time}
            onChange={(time) => setForm((f) => ({ ...f, time }))}
          />
          <Field label={t("Intensité")}>
            <ChipSelect
              options={Object.entries(INTENSITY_META).map(([value, meta]) => ({
                value: value as SessionIntensity,
                label: meta.label,
                icon: meta.icon,
              }))}
              value={form.intensity}
              onChange={(intensity) => setForm((f) => ({ ...f, intensity }))}
            />
          </Field>
          {/* Répéter n'a de sens que pour une séance à venir (cf.
              submitSession, qui l'ignore pour une séance déjà faite). */}
          {!editing && !form.completed ? (
            <RecurrenceField
              value={form.recurrence}
              onChange={(recurrence) => setForm((f) => ({ ...f, recurrence }))}
            />
          ) : null}
          <Field label={t("Notes (optionnel)")}>
            <TextInput
              className={INPUT}
              placeholder={t("Objectif de la séance, points à travailler…")}
              value={form.notes}
              onChangeText={(notes) => setForm((f) => ({ ...f, notes }))}
              multiline
            />
          </Field>
        </>
      </FormDetails>
      {overLimit ? (
        <Text className="text-xs text-danger">
          {t("{createCount} séances d'un coup, c'est trop (maximum {MAX_ENTRIES_PER_SUBMIT}). Réduis la répétition ou le nombre de chevaux.", { createCount: createCount, MAX_ENTRIES_PER_SUBMIT: MAX_ENTRIES_PER_SUBMIT })}
        </Text>
      ) : null}
      <View className="flex-row gap-2">
        <TouchableOpacity accessibilityRole="button"
          onPress={onCancel}
          className="flex-1 items-center rounded-card border border-border p-4"
        >
          <Text className="text-base font-semibold text-muted">{t("Annuler")}</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <PrimaryButton
            label={
              editing
                ? t("Enregistrer")
                : createCount > 1
                  ? t("Ajouter (×{createCount})", { createCount: createCount })
                  : form.completed
                    ? t("Enregistrer la séance")
                    : t("Planifier")
            }
            disabled={!form.date || overLimit || missingHorseChoice}
            onPress={onSubmit}
          />
        </View>
      </View>
    </View>
  );
}
