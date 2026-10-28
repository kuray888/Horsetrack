import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Image } from "@/components/AppImage";
import { colors } from "@/theme/colors";
import { Field } from "@/components/Field";
import { HorseTargetNotice } from "@/horses/components/HorseTargetNotice";
import { FormDetails } from "@/components/FormDetails";
import { DatePickerField } from "@/components/DatePickerField";
import { TimePickerField } from "@/components/TimePickerField";
import { PrimaryButton } from "@/components/onboarding";
import { ChipSelect, AddToggle } from "@/components/FormChips";
import { Locked } from "@/components/Locked";
import { ACTIVITY_META, type ActivityType, type Mood } from "@/agenda/store";
import { MOOD_META } from "@/agenda/meta";
import type { JournalFormValue } from "@/agenda/hooks/useJournalForm";
import { animateNextLayout } from "@/lib/motion";
import { t } from "@/i18n";
import { pickAndPersistVideo } from "@/lib/imagePicker";
import { JournalVideo } from "@/agenda/components/JournalVideo";

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
  targetHorseName = null,
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
  /** Cf. AppointmentForm : cheval rappelé en tête du formulaire. */
  targetHorseName?: string | null;
  onOpen: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  onPickPhoto: () => void;
}) {
  // Cf. AppointmentForm : hook avant le garde `!show`, réaligné au passage
  // création ↔ édition.
  const [showDetails, setShowDetails] = useState(!!editingJournalId);
  const [syncedEditingId, setSyncedEditingId] = useState(editingJournalId);
  if (editingJournalId !== syncedEditingId) {
    setSyncedEditingId(editingJournalId);
    setShowDetails(!!editingJournalId);
  }

  if (!show) {
    return <AddToggle label={t("Ajouter une entrée de journal")} onPress={onOpen} color={colors.primary} />;
  }

  /** Cf. components/FormDetails.tsx. L'heure est préremplie : la replier sans
   * la dire l'enregistrerait sans que rien ne l'ait montrée. */
  const detailsSummary = [
    form.time.trim() || t("sans heure"),
    form.photoUri ? t("avec photo") : null,
    form.videoUri ? t("avec vidéo") : null,
    form.notes.trim() ? t("avec note") : t("sans note"),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View className={`${CARD} gap-3`}>
      <Text className="text-sm font-bold uppercase tracking-wide text-accent">
        {editingJournalId ? t("Modifier l'entrée de journal") : t("Nouvelle entrée de journal")}
      </Text>
      <HorseTargetNotice horseName={targetHorseName} />
      <Field label={t("Activité")}>
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
      <Field label={t("Ressenti")}>
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
      <DatePickerField label={t("Date")} value={form.date} onChange={(date) => setForm((f) => ({ ...f, date }))} />
      <FormDetails open={showDetails} onToggle={() => setShowDetails((v) => !v)} summary={detailsSummary}>
      <TimePickerField label={t("Heure")} value={form.time} onChange={(time) => setForm((f) => ({ ...f, time }))} />
      <Locked message={t("Ajoute la photo du jour pour revoir ses progrès")} placement="journal_photo" feature="journal_photo">
        {form.photoUri ? (
          <TouchableOpacity onPress={onPickPhoto} activeOpacity={0.8} className="gap-2">
            <Image
              source={{ uri: form.photoUri }}
              style={{ width: "100%", height: 160, borderRadius: 20 }}
              contentFit="cover"
            />
            <Text className="text-center text-sm font-semibold text-accent">{t("Changer la photo")}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onPickPhoto}
            activeOpacity={0.8}
            className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-border p-4"
          >
            <MaterialCommunityIcons name="image-outline" size={17} color={colors.textMuted} />
            <Text className="text-sm font-semibold text-muted">{t("Ajouter une photo du jour")}</Text>
          </TouchableOpacity>
        )}
      </Locked>
      <Locked message={t("Ajoute une vidéo d'une minute : un saut, une reprise, un moment")} placement="journal_photo" feature="journal_video">
        {form.videoUri ? (
          <View className="gap-2">
            <JournalVideo uri={form.videoUri} height={180} />
            <View className="flex-row justify-center gap-6">
              <TouchableOpacity
                accessibilityRole="button"
                onPress={async () => {
                  const uri = await pickAndPersistVideo();
                  if (uri) setForm((f) => ({ ...f, videoUri: uri }));
                }}
              >
                <Text className="text-sm font-semibold text-accent">{t("Changer la vidéo")}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" onPress={() => setForm((f) => ({ ...f, videoUri: null }))}>
                <Text className="text-sm font-semibold text-danger">{t("Retirer la vidéo")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={async () => {
              const uri = await pickAndPersistVideo();
              if (uri) setForm((f) => ({ ...f, videoUri: uri }));
            }}
            activeOpacity={0.8}
            className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-border p-4"
          >
            <MaterialCommunityIcons name="video-outline" size={17} color={colors.textMuted} />
            <Text className="text-sm font-semibold text-muted">{t("Ajouter une vidéo (1 min)")}</Text>
          </TouchableOpacity>
        )}
      </Locked>
      <View className="gap-1.5">
        <Text className="text-xs font-semibold uppercase tracking-wide text-muted">{t("Notes (optionnel)")}</Text>
        <TextInput
          className={INPUT}
          placeholder={t("Ex : très bonne séance, cheval détendu")}
          value={form.notes}
          onChangeText={(notes) => setForm((f) => ({ ...f, notes }))}
          multiline
        />
      </View>
      </FormDetails>
      <View className="flex-row gap-2">
        <TouchableOpacity onPress={() => {
          animateNextLayout();
          onCancel();
        }} className="flex-1 items-center rounded-card border border-border p-4">
          <Text className="text-base font-semibold text-muted">{t("Annuler")}</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <PrimaryButton
            label={saving ? t("Un instant…") : editingJournalId ? t("Enregistrer") : t("Ajouter")}
            disabled={!form.date || saving}
            onPress={onSubmit}
          />
        </View>
      </View>
    </View>
  );
}
