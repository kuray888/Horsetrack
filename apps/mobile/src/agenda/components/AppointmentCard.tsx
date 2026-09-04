import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import { formatDate } from "@/lib/dateFormat";
import { Locked } from "@/components/Locked";
import { ChipSelect } from "@/components/FormChips";
import { daysFromNow, type Appointment, type CompetitionEntry } from "@/agenda/store";
import { APPT_META, REMINDER_META, DISCIPLINE_META, formatAmount, daysUntilLabel } from "@/agenda/meta";
import type { Discipline } from "@/onboarding/store";

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
  onUpdateCompetitionEntryResult,
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
  onUpdateCompetitionEntryResult: (entryId: string, result: string) => void;
  onDeleteCompetitionEntry: (entryId: string) => void;
}) {
  const meta = APPT_META[appt.type];
  const [editingResult, setEditingResult] = useState(false);
  const [draftResult, setDraftResult] = useState(appt.result ?? "");
  const [newItemLabel, setNewItemLabel] = useState("");
  const isConcours = appt.type === "concours";
  const isPastConcours = isConcours && appt.date < daysFromNow(0);

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
    <TouchableOpacity activeOpacity={0.85} onPress={onToggleExpand} className={CARD}>
      <View className="flex-row items-center gap-3">
        <View className={`h-11 w-11 items-center justify-center rounded-full ${meta.chip}`}>
          <MaterialCommunityIcons name={meta.icon.name} size={20} color={meta.icon.color} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-bold text-text">{appt.title}</Text>
          <View className="flex-row items-center gap-1">
            <Text className="text-sm text-muted">
              {formatDate(appt.date)} · {appt.time}
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
                Prochaine échéance : {formatDate(appt.nextDueDate)} ({daysUntilLabel(appt.nextDueDate)})
              </Text>
            </View>
          ) : null}
          <View className="flex-row items-center gap-1.5">
            <MaterialCommunityIcons name="bell-outline" size={14} color={colors.textMuted} />
            <Text className="text-sm text-muted">Rappel : {REMINDER_META[appt.reminder].label}</Text>
          </View>

          {isConcours ? (
            <View className="mt-2 gap-2 border-t border-border pt-3">
              <Text className="text-xs font-bold uppercase tracking-wide text-accent">
                Checklist
                {appt.checklist.length > 0
                  ? ` (${appt.checklist.filter((c) => c.checked).length}/${appt.checklist.length} prêt)`
                  : ""}
              </Text>

              {appt.checklist.length > 0 ? (
                <View className="gap-1.5">
                  {appt.checklist.map((item) => (
                    <View key={item.id} className="flex-row items-center gap-2.5 py-1">
                      <TouchableOpacity
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
                      <TouchableOpacity
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
                  placeholder="Ajouter un élément…"
                  value={newItemLabel}
                  onChangeText={setNewItemLabel}
                  onSubmitEditing={handleAddChecklistItem}
                  returnKeyType="done"
                />
                <TouchableOpacity
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
              {appt.dossard ? <Text className="text-sm text-text">N° dossard {appt.dossard}</Text> : null}
              <Text className="text-xs font-bold uppercase tracking-wide text-accent">Épreuves</Text>
              {appt.competitionEntries.length > 0 ? (
                <View className="gap-2">
                  {appt.competitionEntries.map((entry) => (
                    <CompetitionEntryRow
                      key={entry.id}
                      entry={entry}
                      isPast={isPastConcours}
                      onSaveResult={(result) => onUpdateCompetitionEntryResult(entry.id, result)}
                      onDelete={() => onDeleteCompetitionEntry(entry.id)}
                    />
                  ))}
                </View>
              ) : (
                <Text className="text-sm text-muted">Aucune épreuve renseignée.</Text>
              )}
              <Locked message="Plusieurs épreuves par concours réservé à l'abonnement Premium">
                <AddCompetitionEntryForm onAdd={onAddCompetitionEntry} />
              </Locked>
            </View>
          ) : null}

          {isPastConcours ? (
            <View className="mt-2 gap-2 border-t border-border pt-3">
              {editingResult ? (
                <>
                  <Text className="text-xs font-bold uppercase tracking-wide text-accent">
                    Résultat de l&apos;épreuve
                  </Text>
                  <TextInput
                    className={INPUT}
                    placeholder="Ex : 3ème, parcours sans faute"
                    value={draftResult}
                    onChangeText={setDraftResult}
                    multiline
                  />
                  <TouchableOpacity
                    onPress={handleSaveResult}
                    disabled={!draftResult.trim()}
                    activeOpacity={0.85}
                    className={`items-center rounded-full p-3 ${draftResult.trim() ? "bg-primary" : "border border-border"}`}
                  >
                    <Text className={`text-sm font-bold ${draftResult.trim() ? "text-on-primary" : "text-muted"}`}>
                      Enregistrer
                    </Text>
                  </TouchableOpacity>
                </>
              ) : appt.result ? (
                <TouchableOpacity onPress={() => setEditingResult(true)} activeOpacity={0.7} className="gap-1">
                  <Text className="text-xs font-bold uppercase tracking-wide text-accent">Résultat</Text>
                  <Text className="text-sm text-text">{appt.result}</Text>
                  <Text className="text-xs font-semibold text-accent">Modifier</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => setEditingResult(true)} activeOpacity={0.7}>
                  <Text className="text-sm font-semibold text-accent">+ Ajouter le résultat</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          <View className="mt-1 flex-row items-center gap-4">
            <TouchableOpacity onPress={onEdit} activeOpacity={0.7}>
              <Text className="text-sm font-semibold text-accent">Modifier</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} activeOpacity={0.7}>
              <Text className="text-sm font-semibold text-danger">Supprimer ce rendez-vous</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function CompetitionEntryRow({
  entry,
  isPast,
  onSaveResult,
  onDelete,
}: {
  entry: CompetitionEntry;
  isPast: boolean;
  onSaveResult: (result: string) => void;
  onDelete: () => void;
}) {
  const [editingResult, setEditingResult] = useState(false);
  const [draftResult, setDraftResult] = useState(entry.result ?? "");
  const meta = DISCIPLINE_META[entry.discipline];

  function handleSave() {
    if (!draftResult.trim()) return;
    onSaveResult(draftResult.trim());
    setEditingResult(false);
  }

  return (
    <View className="gap-1.5 rounded-card border border-border p-3">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-semibold text-text">{entry.name}</Text>
          <View className="flex-row items-center gap-1">
            <MaterialCommunityIcons name={meta.icon.name} size={12} color={meta.icon.color} />
            <Text className="text-xs text-muted">
              {meta.label} · {entry.time}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onDelete} hitSlop={8} activeOpacity={0.7}>
          <Text className="text-sm text-muted">✕</Text>
        </TouchableOpacity>
      </View>

      {isPast ? (
        editingResult ? (
          <View className="gap-2">
            <TextInput
              className={INPUT}
              placeholder="Ex : 3ème, parcours sans faute"
              value={draftResult}
              onChangeText={setDraftResult}
              multiline
            />
            <TouchableOpacity
              onPress={handleSave}
              disabled={!draftResult.trim()}
              activeOpacity={0.85}
              className={`items-center rounded-full p-2.5 ${draftResult.trim() ? "bg-primary" : "border border-border"}`}
            >
              <Text className={`text-sm font-bold ${draftResult.trim() ? "text-on-primary" : "text-muted"}`}>
                Enregistrer
              </Text>
            </TouchableOpacity>
          </View>
        ) : entry.result ? (
          <TouchableOpacity onPress={() => setEditingResult(true)} activeOpacity={0.7} className="gap-0.5">
            <Text className="text-xs font-bold uppercase tracking-wide text-accent">Résultat</Text>
            <Text className="text-sm text-text">{entry.result}</Text>
            <Text className="text-xs font-semibold text-accent">Modifier</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setEditingResult(true)} activeOpacity={0.7}>
            <Text className="text-sm font-semibold text-accent">+ Ajouter le résultat</Text>
          </TouchableOpacity>
        )
      ) : null}
    </View>
  );
}

function AddCompetitionEntryForm({ onAdd }: { onAdd: (entry: Omit<CompetitionEntry, "id" | "result">) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [discipline, setDiscipline] = useState<Discipline>("SHOW_JUMPING");
  const [time, setTime] = useState("");

  function handleAdd() {
    if (!name.trim() || !time.trim()) return;
    onAdd({ name: name.trim(), discipline, time: time.trim() });
    setName("");
    setDiscipline("SHOW_JUMPING");
    setTime("");
    setOpen(false);
  }

  if (!open) {
    return (
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-border p-2.5"
      >
        <Text className="text-sm font-semibold text-accent">＋ Ajouter une épreuve</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View className="gap-2 rounded-card border border-border p-3">
      <TextInput
        className={INPUT}
        placeholder="Ex : Épreuve club 2 — 1m10"
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
      <TextInput className={INPUT} placeholder="Heure de l'épreuve (ex : 09h15)" value={time} onChangeText={setTime} />
      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={() => setOpen(false)}
          activeOpacity={0.8}
          className="flex-1 items-center rounded-card border border-border p-2.5"
        >
          <Text className="text-sm font-semibold text-muted">Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleAdd}
          disabled={!name.trim() || !time.trim()}
          activeOpacity={0.85}
          className={`flex-1 items-center rounded-card p-2.5 ${name.trim() && time.trim() ? "bg-primary" : "border border-border"}`}
        >
          <Text className={`text-sm font-bold ${name.trim() && time.trim() ? "text-on-primary" : "text-muted"}`}>
            Ajouter
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
