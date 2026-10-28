import { useState } from "react";
import { Linking, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { colors } from "@/theme/colors";
import { formatDate } from "@/lib/dateFormat";
import { Locked } from "@/components/Locked";
import { ChipSelect } from "@/components/FormChips";
import type { Appointment, CompetitionEntry } from "@/agenda/store";
import { APPT_META, REMINDER_META, DISCIPLINE_META, formatAmount, daysUntilLabel } from "@/agenda/meta";
import { cleanCompetitionEntry, competitionEntryTimeLabel } from "@/agenda/competitionEntry";
import type { Discipline } from "@/onboarding/store";
import { animateNextLayout } from "@/lib/motion";
import { addToCalendar } from "@/agenda/addToCalendar";
import { useHorses } from "@/horses/store";
import { t } from "@/i18n";
import { useContacts } from "@/extras/store";
import { contactForAppointment, telUrl } from "@/extras/model";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

export function AppointmentCard({
  appt,
  expanded,
  onToggleExpand,
  onDelete,
  onEdit,
  onSaveResult,
  onToggleChecklistItem,
  onAddChecklistItem,
  onRemoveChecklistItem,
  onAddCompetitionEntry,
  onUpdateCompetitionEntry,
  onDeleteCompetitionEntry,
}: {
  appt: Appointment;
  expanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onSaveResult: (result: string) => void;
  onToggleChecklistItem: (itemId: string) => void;
  onAddChecklistItem: (label: string) => void;
  onRemoveChecklistItem: (itemId: string) => void;
  onAddCompetitionEntry: (entry: Omit<CompetitionEntry, "id" | "result">) => void;
  onUpdateCompetitionEntry: (entryId: string, patch: Partial<Omit<CompetitionEntry, "id">>) => void;
  onDeleteCompetitionEntry: (entryId: string) => void;
}) {
  const meta = APPT_META[appt.type];
  const [editingResult, setEditingResult] = useState(false);
  const [draftResult, setDraftResult] = useState(appt.result ?? "");
  const [newItemLabel, setNewItemLabel] = useState("");
  const isConcours = appt.type === "concours";
  const { horses } = useHorses();
  const contacts = useContacts();
  // Le professionnel du rendez-vous, s'il est dans le carnet (cf. extras/model.ts).
  const contact = contactForAppointment(contacts, appt);
  const contactTel = contact ? telUrl(contact.phone) : null;

  function handleAddToCalendar() {
    // Nom du cheval dans le titre de l'événement (cf. agenda/calendarEvent.ts).
    const horseName = horses.find((h) => h.id === appt.horseId)?.name ?? null;
    void addToCalendar({
      title: appt.title,
      typeLabel: meta.label,
      horseName,
      date: appt.date,
      endDate: appt.endDate,
      time: appt.time,
      location: appt.location,
      notes: appt.notes,
      professional: appt.professional,
      dossard: appt.dossard,
    });
  }

  function handleSaveResult() {
    if (!draftResult.trim()) return;
    onSaveResult(draftResult.trim());
    setEditingResult(false);
  }

  function handleAddChecklistItem() {
    const label = newItemLabel.trim();
    if (!label) return;
    onAddChecklistItem(label);
    setNewItemLabel("");
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      // Même principe que SessionCard : repliée, un élément avec ses actions
      // dans le rotor ; dépliée, la checklist et les champs redeviennent
      // atteignables un par un.
      accessible={!expanded}
      accessibilityLabel={`${appt.title}, ${APPT_META[appt.type].label}, ${formatDate(appt.date)}${appt.time ? `, ${appt.time}` : ""}`}
      accessibilityState={{ expanded }}
      accessibilityActions={[
        { name: "activate", label: expanded ? t("Replier") : t("Déplier") },
        { name: "edit", label: t("Modifier") },
        { name: "calendar", label: t("Ajouter au calendrier") },
        { name: "delete", label: t("Supprimer") },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "activate") {
          animateNextLayout();
          onToggleExpand();
        } else if (e.nativeEvent.actionName === "edit") onEdit();
        else if (e.nativeEvent.actionName === "calendar") handleAddToCalendar();
        else if (e.nativeEvent.actionName === "delete") onDelete();
      }}
      activeOpacity={0.85}
      onPress={() => {
        animateNextLayout();
        onToggleExpand();
      }}
      className={CARD}
    >
      <View className="flex-row items-center gap-3">
        <View className={`h-11 w-11 items-center justify-center rounded-full ${meta.chip}`}>
          <MaterialCommunityIcons name={meta.icon.name} size={20} color={meta.icon.color} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-bold text-text">{appt.title}</Text>
          <View className="flex-row items-center gap-1">
            <Text className="text-sm text-muted">
              {appt.endDate && appt.endDate > appt.date
                ? `${formatDate(appt.date)} → ${formatDate(appt.endDate)}`
                : formatDate(appt.date)}{" "}
              · {appt.time}
            </Text>
            {appt.reminder !== "none" ? (
              <MaterialCommunityIcons name="bell-outline" size={13} color={colors.textMuted} />
            ) : null}
          </View>
        </View>
        <Text className={`text-xs font-bold ${meta.tag}`}>{meta.label}</Text>
      </View>

      {expanded ? (
        <View className="mt-4 gap-2 border-t border-border pt-4">
          {appt.location ? (
            <View className="flex-row items-center gap-1.5">
              <MaterialCommunityIcons name="map-marker-outline" size={15} color={colors.textMuted} />
              <Text className="text-sm text-text">{appt.location}</Text>
            </View>
          ) : null}
          {isConcours && appt.competitionLevel ? (
            <View className="flex-row items-center gap-1.5">
              <MaterialCommunityIcons
                name={appt.competitionLevel === "international" ? "earth" : "flag-outline"}
                size={15}
                color={colors.textMuted}
              />
              <Text className="text-sm text-text">
                {t("Concours ")}{appt.competitionLevel === "international" ? "international" : "national"}
              </Text>
            </View>
          ) : null}
          {appt.professional ? (
            <View className="flex-row items-center gap-1.5">
              <MaterialCommunityIcons name="account-outline" size={15} color={colors.textMuted} />
              <Text className="text-sm text-text">{appt.professional}</Text>
            </View>
          ) : null}
          {appt.cost !== null ? (
            <View className="flex-row items-center gap-1.5">
              <MaterialCommunityIcons name="cash" size={15} color={colors.textMuted} />
              <Text className="text-sm text-text">{formatAmount(appt.cost, "EUR")}</Text>
            </View>
          ) : null}
          {appt.notes ? <Text className="text-sm text-muted">{appt.notes}</Text> : null}
          {appt.nextDueDate ? (
            <View className="flex-row items-center gap-1.5">
              <MaterialCommunityIcons name="calendar-clock-outline" size={15} color={colors.accent} />
              <Text className="text-sm font-semibold text-accent">
                {t("Prochaine échéance : ")}{formatDate(appt.nextDueDate)} ({daysUntilLabel(appt.nextDueDate)})
              </Text>
            </View>
          ) : null}
          <View className="flex-row items-center gap-1.5">
            <MaterialCommunityIcons name="bell-outline" size={14} color={colors.textMuted} />
            <Text className="text-sm text-muted">{t("Rappel : ")}{REMINDER_META[appt.reminder].label}</Text>
          </View>

          {isConcours ? (
            <View className="mt-2 gap-2 border-t border-border pt-3">
              <Text className="text-xs font-bold uppercase tracking-wide text-accent">
                {t("Checklist")}
                {appt.checklist.length > 0
                  ? t(" ({length}/{length2} prêt)", { length: appt.checklist.filter((c) => c.checked).length, length2: appt.checklist.length })
                  : ""}
              </Text>

              {appt.checklist.length > 0 ? (
                <View className="gap-1.5">
                  {appt.checklist.map((item) => (
                    <View key={item.id} className="flex-row items-center gap-2.5 py-1">
                      <TouchableOpacity accessibilityRole="button"
                        onPress={() => onToggleChecklistItem(item.id)}
                        activeOpacity={0.7}
                        className="flex-1 flex-row items-center gap-2.5"
                      >
                        <View
                          className={`h-5 w-5 items-center justify-center rounded-full border ${
                            item.checked ? "border-success bg-success" : "border-border"
                          }`}
                        >
                          {item.checked ? <Text className="text-xs text-on-primary">✓</Text> : null}
                        </View>
                        <Text
                          className={`flex-1 text-sm ${item.checked ? "text-muted line-through" : "text-text"}`}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity accessibilityRole="button"
                        onPress={() => onRemoveChecklistItem(item.id)}
                        activeOpacity={0.7}
                        hitSlop={8}
                      >
                        <Text className="text-sm text-muted">✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null}

              <View className="mt-1 flex-row items-center gap-2">
                <TextInput
                  className="flex-1 rounded-card border border-border bg-surface px-3 py-2.5 text-sm text-text"
                  placeholder={t("Ajouter un élément…")}
                  value={newItemLabel}
                  onChangeText={setNewItemLabel}
                  onSubmitEditing={handleAddChecklistItem}
                  returnKeyType="done"
                />
                <TouchableOpacity accessibilityRole="button"
                  onPress={handleAddChecklistItem}
                  disabled={!newItemLabel.trim()}
                  activeOpacity={0.8}
                  className={`h-9 w-9 items-center justify-center rounded-full ${
                    newItemLabel.trim() ? "bg-primary" : "bg-border"
                  }`}
                >
                  <Text className={`text-base font-bold ${newItemLabel.trim() ? "text-on-primary" : "text-muted"}`}>
                    +
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {isConcours ? (
            <View className="mt-2 gap-2 border-t border-border pt-3">
              {appt.dossard ? <Text className="text-sm text-text">{t("N° dossard ")}{appt.dossard}</Text> : null}
              <Text className="text-xs font-bold uppercase tracking-wide text-accent">{t("Épreuves")}</Text>
              {appt.competitionEntries.length > 0 ? (
                <View className="gap-2">
                  {appt.competitionEntries.map((entry) => (
                    <CompetitionEntryRow
                      key={entry.id}
                      entry={entry}
                      onUpdate={(patch) => onUpdateCompetitionEntry(entry.id, patch)}
                      onDelete={() => onDeleteCompetitionEntry(entry.id)}
                    />
                  ))}
                </View>
              ) : (
                <Text className="text-sm text-muted">{t("Aucune épreuve renseignée.")}</Text>
              )}
              <Locked message={t("Détaille chaque épreuve : horaires, résultats")} placement="competitions" feature="competition_detail">
                <AddCompetitionEntryForm onAdd={onAddCompetitionEntry} />
              </Locked>
            </View>
          ) : null}

          {isConcours ? (
            <View className="mt-2 gap-2 border-t border-border pt-3">
              {editingResult ? (
                <>
                  <Text className="text-xs font-bold uppercase tracking-wide text-accent">
                    {t("Résultat de l'épreuve")}
                  </Text>
                  <TextInput
                    className={INPUT}
                    placeholder={t("Ex : 3ème, parcours sans faute")}
                    value={draftResult}
                    onChangeText={setDraftResult}
                    multiline
                  />
                  <TouchableOpacity accessibilityRole="button"
                    onPress={handleSaveResult}
                    disabled={!draftResult.trim()}
                    activeOpacity={0.85}
                    className={`items-center rounded-full p-3 ${draftResult.trim() ? "bg-primary" : "border border-border"}`}
                  >
                    <Text className={`text-sm font-bold ${draftResult.trim() ? "text-on-primary" : "text-muted"}`}>
                      {t("Enregistrer")}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : appt.result ? (
                <TouchableOpacity accessibilityRole="button" onPress={() => setEditingResult(true)} activeOpacity={0.7} className="gap-1">
                  <Text className="text-xs font-bold uppercase tracking-wide text-accent">{t("Résultat")}</Text>
                  <Text className="text-sm text-text">{appt.result}</Text>
                  <Text className="text-xs font-semibold text-accent">{t("Modifier")}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity accessibilityRole="button" onPress={() => setEditingResult(true)} activeOpacity={0.7} className="gap-1">
                  <Text className="text-xs font-bold uppercase tracking-wide text-accent">{t("Résultat")}</Text>
                  <Text className="text-sm font-semibold text-accent">{t("+ Noter le résultat du concours")}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          <View className="mt-1 flex-row items-center gap-4">
            <TouchableOpacity accessibilityRole="button" onPress={onEdit} activeOpacity={0.7}>
              <Text className="text-sm font-semibold text-accent">{t("Modifier")}</Text>
            </TouchableOpacity>
            {contact && contactTel ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t("Appeler {name}", { name: contact.name })}
                onPress={() => void Linking.openURL(contactTel)}
                activeOpacity={0.7}
              >
                <Text className="text-sm font-semibold text-accent">{t("Appeler")}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity accessibilityRole="button" onPress={handleAddToCalendar} activeOpacity={0.7}>
              <Text className="text-sm font-semibold text-accent">{t("Calendrier")}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={onDelete} activeOpacity={0.7}>
              <Text className="text-sm font-semibold text-danger">{t("Supprimer")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function CompetitionEntryRow({
  entry,
  onUpdate,
  onDelete,
}: {
  entry: CompetitionEntry;
  onUpdate: (patch: Partial<Omit<CompetitionEntry, "id">>) => void;
  onDelete: () => void;
}) {
  const [editingEntry, setEditingEntry] = useState(false);
  const [editingResult, setEditingResult] = useState(false);
  const [draftResult, setDraftResult] = useState(entry.result ?? "");
  const meta = DISCIPLINE_META[entry.discipline];

  function handleSave() {
    if (!draftResult.trim()) return;
    onUpdate({ result: draftResult.trim() });
    setEditingResult(false);
  }

  if (editingEntry) {
    return (
      <CompetitionEntryEditor
        initial={entry}
        submitLabel={t("Enregistrer")}
        onSubmit={(fields) => {
          onUpdate(fields);
          setEditingEntry(false);
        }}
        onCancel={() => setEditingEntry(false)}
      />
    );
  }

  return (
    <View className="gap-1.5 rounded-card border border-border p-3">
      <View className="flex-row items-center justify-between gap-2">
        {/* Toute la ligne ouvre la modification : l'heure de passage arrive
            souvent après l'inscription à l'épreuve. */}
        <TouchableOpacity
          onPress={() => setEditingEntry(true)}
          activeOpacity={0.7}
          className="flex-1 gap-0.5"
          accessibilityRole="button"
          accessibilityLabel={t("Modifier l'épreuve {name}", { name: entry.name })}
        >
          <Text className="text-sm font-semibold text-text">{entry.name}</Text>
          <View className="flex-row items-center gap-1">
            <MaterialCommunityIcons name={meta.icon.name} size={12} color={meta.icon.color} />
            <Text className="text-xs text-muted">
              {meta.label} · {competitionEntryTimeLabel(entry.time)}
            </Text>
          </View>
          <Text className="text-xs font-semibold text-accent">{entry.time ? t("Modifier") : t("+ Ajouter l'heure")}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={onDelete} hitSlop={8} activeOpacity={0.7}>
          <Text className="text-sm text-muted">✕</Text>
        </TouchableOpacity>
      </View>

      {editingResult ? (
        <View className="gap-2">
          <TextInput
            className={INPUT}
            placeholder={t("Ex : 3ème, parcours sans faute")}
            value={draftResult}
            onChangeText={setDraftResult}
            multiline
          />
          <TouchableOpacity accessibilityRole="button"
            onPress={handleSave}
            disabled={!draftResult.trim()}
            activeOpacity={0.85}
            className={`items-center rounded-full p-2.5 ${draftResult.trim() ? "bg-primary" : "border border-border"}`}
          >
            <Text className={`text-sm font-bold ${draftResult.trim() ? "text-on-primary" : "text-muted"}`}>
              {t("Enregistrer")}
            </Text>
          </TouchableOpacity>
        </View>
      ) : entry.result ? (
        <TouchableOpacity accessibilityRole="button" onPress={() => setEditingResult(true)} activeOpacity={0.7} className="gap-0.5">
          <Text className="text-xs font-bold uppercase tracking-wide text-accent">{t("Résultat")}</Text>
          <Text className="text-sm text-text">{entry.result}</Text>
          <Text className="text-xs font-semibold text-accent">{t("Modifier")}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity accessibilityRole="button" onPress={() => setEditingResult(true)} activeOpacity={0.7}>
          <Text className="text-sm font-semibold text-accent">{t("+ Ajouter le résultat")}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Nom, discipline et heure d'une épreuve — partagé entre l'ajout et la
 * modification. Seul le nom est requis (cf. agenda/competitionEntry.ts). */
function CompetitionEntryEditor({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Pick<CompetitionEntry, "name" | "discipline" | "time">;
  submitLabel: string;
  onSubmit: (entry: Omit<CompetitionEntry, "id" | "result">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [discipline, setDiscipline] = useState<Discipline>(initial?.discipline ?? "SHOW_JUMPING");
  const [time, setTime] = useState(initial?.time ?? "");
  const cleaned = cleanCompetitionEntry({ name, discipline, time });

  return (
    <View className="gap-2 rounded-card border border-border p-3">
      <TextInput
        className={INPUT}
        placeholder={t("Ex : Épreuve club 2 — 1m10")}
        value={name}
        onChangeText={setName}
      />
      <ChipSelect
        options={Object.entries(DISCIPLINE_META).map(([value, meta]) => ({
          value: value as Discipline,
          label: meta.label,
          icon: meta.icon,
        }))}
        value={discipline}
        onChange={setDiscipline}
      />
      <TextInput
        className={INPUT}
        placeholder={t("Heure de passage (facultatif, ex : 09h15)")}
        value={time}
        onChangeText={setTime}
      />
      <View className="flex-row gap-2">
        <TouchableOpacity accessibilityRole="button"
          onPress={() => {
            animateNextLayout();
            onCancel();
          }}
          activeOpacity={0.8}
          className="flex-1 items-center rounded-card border border-border p-2.5"
        >
          <Text className="text-sm font-semibold text-muted">{t("Annuler")}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button"
          onPress={() => cleaned && onSubmit(cleaned)}
          disabled={!cleaned}
          activeOpacity={0.85}
          className={`flex-1 items-center rounded-card p-2.5 ${cleaned ? "bg-primary" : "border border-border"}`}
        >
          <Text className={`text-sm font-bold ${cleaned ? "text-on-primary" : "text-muted"}`}>{submitLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AddCompetitionEntryForm({ onAdd }: { onAdd: (entry: Omit<CompetitionEntry, "id" | "result">) => void }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <TouchableOpacity accessibilityRole="button"
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-border p-2.5"
      >
        <Text className="text-sm font-semibold text-accent">{t("＋ Ajouter une épreuve")}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <CompetitionEntryEditor
      submitLabel={t("Ajouter")}
      onSubmit={(entry) => {
        onAdd(entry);
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  );
}
