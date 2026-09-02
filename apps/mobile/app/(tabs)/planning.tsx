import { useState } from "react";
import { Alert, Animated, Text, TextInput, TouchableOpacity, View } from "react-native";
import { FadeInView } from "@/components/FadeInView";
import { Screen } from "@/components/Screen";
import { Field } from "@/components/Field";
import { DatePickerField } from "@/components/DatePickerField";
import { TimePickerField } from "@/components/TimePickerField";
import { PrimaryButton } from "@/components/onboarding";
import { usePressScale } from "@/hooks/usePressScale";
import { formatDate } from "@/lib/dateFormat";
import { useHorses } from "@/horses/store";
import { ACTIVITY_META, type ActivityType } from "@/agenda/store";
import { useSessions, type SessionIntensity, type TrainingSession } from "@/sessions/store";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

const DURATION_OPTIONS = [30, 45, 60, 90];

const INTENSITY_META: Record<SessionIntensity, { label: string; icon: string }> = {
  low: { label: "Légère", icon: "🟢" },
  medium: { label: "Modérée", icon: "🟠" },
  high: { label: "Intense", icon: "🔴" },
};

function ChipSelect<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
            className={`flex-row items-center gap-1.5 rounded-full border px-3.5 py-2 ${
              selected ? "border-primary bg-highlight" : "border-border bg-surface"
            }`}
          >
            <Text className="text-sm">{opt.icon}</Text>
            <Text className={`text-sm font-semibold ${selected ? "text-primary" : "text-text"}`}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function AddToggle({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-primary p-4"
    >
      <Text className="text-lg font-bold text-primary">＋</Text>
      <Text className="text-base font-semibold text-primary">{label}</Text>
    </TouchableOpacity>
  );
}

type SessionForm = {
  activityType: ActivityType;
  date: Date | null;
  time: string;
  durationMinutes: number;
  intensity: SessionIntensity;
  notes: string;
};

function emptyForm(): SessionForm {
  return { activityType: "dressage", date: new Date(), time: "", durationMinutes: 45, intensity: "medium", notes: "" };
}

function formFromSession(session: TrainingSession): SessionForm {
  return {
    activityType: session.activityType,
    date: session.date,
    time: session.time,
    durationMinutes: session.durationMinutes ?? 45,
    intensity: session.intensity ?? "medium",
    notes: session.notes,
  };
}

function SessionCard({
  session,
  expanded,
  onPress,
  onToggleDone,
  onEdit,
  onDelete,
}: {
  session: TrainingSession;
  expanded: boolean;
  onPress: () => void;
  onToggleDone: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { scale, onPressIn, onPressOut } = usePressScale();
  const meta = ACTIVITY_META[session.activityType];
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        className={`${CARD} gap-3`}
      >
        <View className="flex-row items-center gap-3">
          <View
            className={`h-11 w-11 items-center justify-center rounded-full ${
              session.completed ? "bg-success/15" : meta.chip
            }`}
          >
            <Text className="text-lg">{session.completed ? "✓" : meta.icon}</Text>
          </View>
          <View className="flex-1 gap-0.5">
            <Text className={`text-base font-bold ${session.completed ? "text-muted line-through" : "text-text"}`}>
              {meta.label}
            </Text>
            <Text className="text-sm text-muted">
              {formatDate(session.date)} · {session.time || "Heure libre"}
              {session.durationMinutes ? ` · ${session.durationMinutes} min` : ""}
            </Text>
          </View>
          <Text className="text-base text-muted">{expanded ? "︿" : "›"}</Text>
        </View>

        {expanded ? (
          <View className="gap-3 border-t border-border pt-3">
            {session.intensity ? (
              <Text className="text-sm text-muted">
                Intensité : {INTENSITY_META[session.intensity].icon} {INTENSITY_META[session.intensity].label}
              </Text>
            ) : null}
            {session.notes.trim() ? <Text className="text-sm leading-5 text-text">{session.notes}</Text> : null}
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={onToggleDone}
                activeOpacity={0.8}
                className="flex-1 items-center rounded-card bg-primary p-3"
              >
                <Text className="text-sm font-bold text-on-primary">
                  {session.completed ? "Marquer à faire" : "Marquer faite"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onEdit}
                activeOpacity={0.8}
                className="flex-1 items-center rounded-card border border-border p-3"
              >
                <Text className="text-sm font-semibold text-text">Modifier</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onDelete}
                activeOpacity={0.8}
                className="items-center justify-center rounded-card border border-border px-4"
              >
                <Text className="text-sm font-semibold text-warning">Suppr.</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function PlanningScreen() {
  const { selectedHorse } = useHorses();
  const { sessions, addSession, updateSession, deleteSession, toggleCompleted } = useSessions();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SessionForm>(emptyForm());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const horseSessions = sessions.filter((s) => s.horseId === selectedHorse?.id);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const upcoming = horseSessions
    .filter((s) => !s.completed && s.date >= todayStart)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const done = horseSessions
    .filter((s) => s.completed || s.date < todayStart)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function openEditForm(session: TrainingSession) {
    setEditingId(session.id);
    setForm(formFromSession(session));
    setExpandedId(null);
    setShowForm(true);
  }

  function handleSubmit() {
    if (!form.date) return;
    if (editingId) {
      const existing = horseSessions.find((s) => s.id === editingId);
      if (!existing) return;
      updateSession({
        ...existing,
        activityType: form.activityType,
        date: form.date,
        time: form.time,
        durationMinutes: form.durationMinutes,
        intensity: form.intensity,
        notes: form.notes,
      });
    } else {
      addSession({
        activityType: form.activityType,
        date: form.date,
        time: form.time,
        durationMinutes: form.durationMinutes,
        intensity: form.intensity,
        notes: form.notes,
      });
    }
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  }

  function confirmDelete(session: TrainingSession) {
    Alert.alert("Supprimer cette séance ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => deleteSession(session.id) },
    ]);
  }

  return (
    <Screen>
      <FadeInView>
        <Text className="text-3xl font-extrabold tracking-tight text-text">Planning</Text>
      </FadeInView>

      <FadeInView delay={60}>
        {showForm ? (
          <View className={`${CARD} gap-3`}>
            <Text className="text-sm font-bold uppercase tracking-wide text-accent">
              {editingId ? "Modifier la séance" : "Nouvelle séance"}
            </Text>
            <Field label="Type de séance">
              <ChipSelect
                options={Object.entries(ACTIVITY_META).map(([value, meta]) => ({
                  value: value as ActivityType,
                  label: meta.label,
                  icon: meta.icon,
                }))}
                value={form.activityType}
                onChange={(activityType) => setForm((f) => ({ ...f, activityType }))}
              />
            </Field>
            <DatePickerField label="Date" value={form.date} onChange={(date) => setForm((f) => ({ ...f, date }))} />
            <TimePickerField label="Heure (optionnel)" value={form.time} onChange={(time) => setForm((f) => ({ ...f, time }))} />
            <Field label="Durée">
              <ChipSelect
                options={DURATION_OPTIONS.map((min) => ({ value: String(min), label: `${min} min`, icon: "⏱️" }))}
                value={String(form.durationMinutes)}
                onChange={(v) => setForm((f) => ({ ...f, durationMinutes: Number(v) }))}
              />
            </Field>
            <Field label="Intensité">
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
            <Field label="Notes (optionnel)">
              <TextInput
                className={INPUT}
                placeholder="Objectif de la séance, points à travailler…"
                value={form.notes}
                onChangeText={(notes) => setForm((f) => ({ ...f, notes }))}
                multiline
              />
            </Field>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setForm(emptyForm());
                }}
                className="flex-1 items-center rounded-card border border-border p-4"
              >
                <Text className="text-base font-semibold text-muted">Annuler</Text>
              </TouchableOpacity>
              <View className="flex-1">
                <PrimaryButton label={editingId ? "Enregistrer" : "Ajouter"} disabled={!form.date} onPress={handleSubmit} />
              </View>
            </View>
          </View>
        ) : (
          <AddToggle label="Planifier une séance" onPress={openCreateForm} />
        )}
      </FadeInView>

      <FadeInView delay={120}>
        <Text className="text-xl font-bold text-text">À venir</Text>
      </FadeInView>

      {upcoming.length === 0 ? (
        <FadeInView delay={160}>
          <View className={`${CARD} items-center gap-1`}>
            <Text className="text-2xl">🌿</Text>
            <Text className="text-sm text-muted">Aucune séance planifiée.</Text>
          </View>
        </FadeInView>
      ) : (
        upcoming.map((session, i) => (
          <FadeInView key={session.id} delay={160 + i * 50}>
            <SessionCard
              session={session}
              expanded={expandedId === session.id}
              onPress={() => setExpandedId(expandedId === session.id ? null : session.id)}
              onToggleDone={() => toggleCompleted(session.id)}
              onEdit={() => openEditForm(session)}
              onDelete={() => confirmDelete(session)}
            />
          </FadeInView>
        ))
      )}

      {done.length > 0 ? (
        <>
          <FadeInView delay={220}>
            <Text className="mt-2 text-xl font-bold text-text">Passées</Text>
          </FadeInView>
          {done.slice(0, 20).map((session, i) => (
            <FadeInView key={session.id} delay={240 + i * 40}>
              <SessionCard
                session={session}
                expanded={expandedId === session.id}
                onPress={() => setExpandedId(expandedId === session.id ? null : session.id)}
                onToggleDone={() => toggleCompleted(session.id)}
                onEdit={() => openEditForm(session)}
                onDelete={() => confirmDelete(session)}
              />
            </FadeInView>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
