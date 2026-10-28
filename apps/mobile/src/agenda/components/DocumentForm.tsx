import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { colors } from "@/theme/colors";
import { Field } from "@/components/Field";
import { DatePickerField } from "@/components/DatePickerField";
import { PrimaryButton } from "@/components/onboarding";
import { ChipSelect, AddToggle } from "@/components/FormChips";
import { Locked } from "@/components/Locked";
import type { DocumentCategory } from "@/agenda/store";
import { DOC_META } from "@/agenda/meta";
import type { DocumentFormValue } from "@/agenda/hooks/useDocumentForm";
import { AttachmentPreview } from "@/agenda/components/AttachmentPreview";
import { animateNextLayout } from "@/lib/motion";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

/** Formulaire de document (création/édition) d'AgendaScreen — JSX extrait tel
 * quel (cf. plan Phase 3 Étape 1), aucun changement de comportement. Le
 * `Locked` ne couvre que le bouton d'ouverture (état fermé), pas le
 * formulaire une fois ouvert — comme dans le ternaire d'origine. */
export function DocumentForm({
  show,
  form,
  setForm,
  editingDocId,
  onOpen,
  onCancel,
  onSubmit,
  onPickDocument,
}: {
  show: boolean;
  form: DocumentFormValue;
  setForm: (updater: (f: DocumentFormValue) => DocumentFormValue) => void;
  editingDocId: string | null;
  onOpen: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  onPickDocument: () => void;
}) {
  if (!show) {
    return (
      <Locked message={t("Range ordonnances, factures et carnet de santé au même endroit")} placement="vault" feature="document_add">
        <AddToggle label={t("Ajouter un document")} onPress={onOpen} color={colors.primary} />
      </Locked>
    );
  }

  return (
    <View className={`${CARD} gap-3`}>
      <Text className="text-sm font-bold uppercase tracking-wide text-accent">
        {editingDocId ? t("Modifier le document") : t("Nouveau document")}
      </Text>
      <Field label={t("Catégorie")}>
        <ChipSelect
          options={Object.entries(DOC_META).map(([value, meta]) => ({
            value: value as DocumentCategory,
            label: meta.label,
            icon: meta.icon,
          }))}
          value={form.category}
          onChange={(category) => setForm((f) => ({ ...f, category }))}
        />
      </Field>
      <Field label={t("Nom du document")}>
        <TextInput
          className={INPUT}
          placeholder={t("Ex : Facture maréchal")}
          value={form.name}
          onChangeText={(name) => setForm((f) => ({ ...f, name }))}
        />
      </Field>
      <DatePickerField label={t("Date")} value={form.date} onChange={(date) => setForm((f) => ({ ...f, date }))} />
      {form.fileUri ? (
        <TouchableOpacity onPress={onPickDocument} activeOpacity={0.8} className="gap-2">
          <AttachmentPreview uri={form.fileUri} />
          <Text className="text-center text-sm font-semibold text-accent">{t("Changer le document")}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={onPickDocument}
          activeOpacity={0.8}
          className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-border p-4"
        >
          <MaterialCommunityIcons name="paperclip" size={17} color={colors.textMuted} />
          <Text className="text-sm font-semibold text-muted">{t("Joindre des photos ou un PDF")}</Text>
        </TouchableOpacity>
      )}
      <View className="flex-row gap-2">
        <TouchableOpacity onPress={() => {
          animateNextLayout();
          onCancel();
        }} className="flex-1 items-center rounded-card border border-border p-4">
          <Text className="text-base font-semibold text-muted">{t("Annuler")}</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <PrimaryButton
            label={editingDocId ? t("Enregistrer") : t("Ajouter")}
            disabled={!form.name.trim() || !form.date}
            onPress={onSubmit}
          />
        </View>
      </View>
    </View>
  );
}
