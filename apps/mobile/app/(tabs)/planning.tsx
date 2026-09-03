import { useState } from "react";
import { Alert, Animated, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { FadeInView } from "@/components/FadeInView";
import { Screen } from "@/components/Screen";
import { Field } from "@/components/Field";
import { DatePickerField } from "@/components/DatePickerField";
import { TimePickerField } from "@/components/TimePickerField";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { PrimaryButton } from "@/components/onboarding";
import { usePressScale } from "@/hooks/usePressScale";
import { colors } from "@/theme/colors";
import { formatDate, formatDuration, isSameDate, MONTHS } from "@/lib/dateFormat";
import { useHorses } from "@/horses/store";
import { ACTIVITY_META, type ActivityType } from "@/agenda/store";
import { useSessions, type SessionIntensity, type TrainingSession } from "@/sessions/store";

type IconSpec = { name: keyof typeof MaterialCommunityIcons.glyphMap; color: string };

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";
const DAY_SHORT = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];

const DURATION_OPTIONS = [30, 45, 60, 90];
const REPEAT_OPTIONS = [
  { value: 1, label: "Ne pas répéter" },
  { value: 4, label: "4 semaines" },
  { value: 8, label: "8 semaines" },
];

const INTENSITY_META: Record<SessionIntensity, { label: string; icon: IconSpec }> = {
  low: { label: "Légère", icon: { name: "circle", color: colors.success } },
  medium: { label: "Modérée", icon: { name: "circle", color: colors.warning } },
  high: { label: "Intense", icon: { name: "circle", color: colors.danger } },
};

function dayHeaderLabel(date: Date): string {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  if (isSameDate(date, todayStart)) return "Aujourd'hui";
  if (isSameDate(date, tomorrowStart)) return "Demain";
  return `${DAY_SHORT[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** Regroupe une liste déjà triée par date en blocs par jour, pour un affichage
 * "Aujourd'hui / Demain / Lun. 8 sept." plus lisible qu'une liste plate. */
function groupByDay<T extends { date: Date }>(items: T[]): { key: string; label: string; items: T[] }[] {
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const key = item.date.toDateString();
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: dayHeaderLabel(item.date), items: [item] });
  }
  return groups;
}

function ChipSelect<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon: IconSpec }[];
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
            accessibilityLabel={opt.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`flex-row items-center gap-1.5 rounded-full border px-3.5 py-2 ${
              selected ? "border-primary bg-highlight" : "border-border bg-surface"
            }`}
          >
            <MaterialCommunityIcons name={opt.icon.name} size={15} color={opt.icon.color} accessibilityElementsHidden />
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
      <MaterialCommunityIcons name="plus" size={18} color={colors.primary} />
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
  repeatWeeks: number;
};

function emptyForm(): SessionForm {
  return {
    activityType: "dressage",
    date: new Date(),
    time: "",
    durationMinutes: 45,
    intensity: "medium",
    notes: "",
    repeatWeeks: 1,
  };
}

function formFromSession(session: TrainingSession): SessionForm {
  return {
    activityType: session.activityType,
    date: session.date,
    time: session.time,
    durationMinutes: session.durationMinutes ?? 45,
    intensity: session.intensity ?? "medium",
    notes: session.notes,
    repeatWeeks: 1,
  };
}

function SessionCard({
  session,
  expanded,
  onPress,
  onToggleDone,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  session: TrainingSession;
  expanded: boolean;
  onPress: () => void;
  onToggleDone: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
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
            <MaterialCommunityIcons
              name={session.completed ? "check" : meta.icon}
              size={20}
              color={session.completed ? colors.success : meta.tint}
            />
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
          <MaterialCommunityIcons
            name={expanded ? "chevron-up" : "chevron-right"}
            size={20}
            color={colors.textMuted}
          />
        </View>

        {expanded ? (
          <View className="gap-3 border-t border-border pt-3">
            {session.intensity ? (
              <View className="flex-row items-center gap-1.5">
                <MaterialCommunityIcons name={INTENSITY_META[session.intensity].icon.name} size={12} color={INTENSITY_META[session.intensity].icon.color} />
                <Text className="text-sm text-muted">Intensité : {INTENSITY_META[session.intensity].label}</Text>
              </View>
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
            </View>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={onDuplicate}
                activeOpacity={0.8}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-card border border-border p-3"
              >
                <MaterialCommunityIcons name="content-copy" size={15} color={colors.textMuted} />
                <Text className="text-sm font-semibold text-text">Dupliquer +7j</Text>
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
  const [filter, setFilter] = useState<ActivityType | "all">("all");

  const horseSessions = sessions.filter((s) => s.horseId === selectedHorse?.id);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Lundi de la semaine en cours, même convention que Today (0 = lundi).
  const weekOffset = (today.getDay() + 6) % 7;
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekSessions = horseSessions.filter((s) => s.date >= weekStart && s.date < weekEnd);
  const weekDone = weekSessions.filter((s) => s.completed).length;
  const weekMinutes = weekSessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

  const filteredSessions = filter === "all" ? horseSessions : horseSessions.filter((s) => s.activityType === filter);

  const upcoming = filteredSessions
    .filter((s) => !s.completed && s.date >= todayStart)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const done = filteredSessions
    .filter((s) => s.completed || s.date < todayStart)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const upcomingGroups = groupByDay(upcoming);
  const doneGroups = groupByDay(done.slice(0, 20));

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
      // repeatWeeks > 1 : crée une séance identique chaque semaine sur N
      // semaines (ex: "4 semaines" => 4 séances au total, celle-ci incluse) —
      // pas de notion de "série" liée côté modèle, chaque occurrence est une
      // TrainingSession indépendante (éditable/supprimable une par une).
      for (let i = 0; i < form.repeatWeeks; i++) {
        const date = new Date(form.date);
        date.setDate(date.getDate() + i * 7);
        addSession({
          activityType: form.activityType,
          date,
          time: form.time,
          durationMinutes: form.durationMinutes,
          intensity: form.intensity,
          notes: form.notes,
        });
      }
    }
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  }

  function handleDuplicate(session: TrainingSession) {
    const date = new Date(session.date);
    date.setDate(date.getDate() + 7);
    addSession({
      activityType: session.activityType,
      date,
      time: session.time,
      durationMinutes: session.durationMinutes,
      intensity: session.intensity,
      notes: session.notes,
    });
  }

  function confirmDelete(session: TrainingSession) {
    Alert.alert("Supprimer cette séance ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => deleteSession(session.id) },
    ]);
  }

  return (
    <>
    <Screen>
      <FadeInView>
        <View className="gap-1">
          <Text className="text-3xl font-extrabold tracking-tight text-text">Planning</Text>
          <Text className="text-base text-muted">Séances d&apos;entraînement de {selectedHorse?.name ?? "ton cheval"}</Text>
        </View>
      </FadeInView>

      {weekSessions.length > 0 ? (
        <FadeInView delay={40}>
          <View className={`${CARD} flex-row gap-3`}>
            <View className="h-10 w-10 items-center justify-center rounded-full bg-accent/15">
              <MaterialCommunityIcons name="chart-line" size={20} color={colors.accent} />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-bold uppercase tracking-wide text-accent">Cette semaine</Text>
              <Text className="text-[15px] leading-5 text-text">
                {weekDone}/{weekSessions.length} séance{weekSessions.length > 1 ? "s" : ""} faite
                {weekDone > 1 ? "s" : ""} · {formatDuration(weekMinutes)} au programme
              </Text>
            </View>
          </View>
        </FadeInView>
      ) : null}

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
                  icon: { name: meta.icon, color: meta.tint },
                }))}
                value={form.activityType}
                onChange={(activityType) => setForm((f) => ({ ...f, activityType }))}
              />
            </Field>
            <DatePickerField label="Date" value={form.date} onChange={(date) => setForm((f) => ({ ...f, date }))} />
            <TimePickerField label="Heure (optionnel)" value={form.time} onChange={(time) => setForm((f) => ({ ...f, time }))} />
            <Field label="Durée">
              <ChipSelect
                options={DURATION_OPTIONS.map((min) => ({
                  value: String(min),
                  label: `${min} min`,
                  icon: { name: "timer-outline" as const, color: colors.textMuted },
                }))}
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
            {!editingId ? (
              <Field label="Répéter chaque semaine">
                <ChipSelect
                  options={REPEAT_OPTIONS.map((opt) => ({
                    value: String(opt.value),
                    label: opt.label,
                    icon: { name: "repeat" as const, color: colors.textMuted },
                  }))}
                  value={String(form.repeatWeeks)}
                  onChange={(v) => setForm((f) => ({ ...f, repeatWeeks: Number(v) }))}
                />
              </Field>
            ) : null}
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
                <PrimaryButton
                  label={editingId ? "Enregistrer" : form.repeatWeeks > 1 ? `Ajouter (×${form.repeatWeeks})` : "Ajouter"}
                  disabled={!form.date}
                  onPress={handleSubmit}
                />
              </View>
            </View>
          </View>
        ) : (
          <AddToggle label="Planifier une séance" onPress={openCreateForm} />
        )}
      </FadeInView>

      {!showForm && horseSessions.length > 0 ? (
        <FadeInView delay={90}>
          <View className="flex-row flex-wrap gap-2">
            <TouchableOpacity
              onPress={() => setFilter("all")}
              activeOpacity={0.8}
              accessibilityLabel="Toutes"
              accessibilityRole="button"
              accessibilityState={{ selected: filter === "all" }}
              className={`flex-row items-center gap-1.5 rounded-full border px-3.5 py-2 ${
                filter === "all" ? "border-primary bg-highlight" : "border-border bg-surface"
              }`}
            >
              <MaterialCommunityIcons name="view-grid-outline" size={15} color={filter === "all" ? colors.primary : colors.textMuted} accessibilityElementsHidden />
              <Text className={`text-sm font-semibold ${filter === "all" ? "text-primary" : "text-text"}`}>Toutes</Text>
            </TouchableOpacity>
            {Object.entries(ACTIVITY_META).map(([value, meta]) => {
              const selected = filter === value;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => setFilter(selected ? "all" : (value as ActivityType))}
                  activeOpacity={0.8}
                  accessibilityLabel={meta.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`flex-row items-center gap-1.5 rounded-full border px-3.5 py-2 ${
                    selected ? "border-primary bg-highlight" : "border-border bg-surface"
                  }`}
                >
                  <MaterialCommunityIcons name={meta.icon} size={15} color={selected ? colors.primary : meta.tint} accessibilityElementsHidden />
                  <Text className={`text-sm font-semibold ${selected ? "text-primary" : "text-text"}`}>{meta.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </FadeInView>
      ) : null}

      <FadeInView delay={120}>
        <Text className="text-xl font-bold text-text">À venir</Text>
      </FadeInView>

      {upcoming.length === 0 ? (
        <FadeInView delay={160}>
          <View className={`${CARD} items-center gap-2`}>
            <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
              <MaterialCommunityIcons name="calendar-blank-outline" size={22} color={colors.textMuted} />
            </View>
            <Text className="text-sm text-muted">
              {filter === "all" ? "Aucune séance planifiée." : "Aucune séance de ce type à venir."}
            </Text>
          </View>
        </FadeInView>
      ) : (
        upcomingGroups.map((group, gi) => (
          <View key={group.key} className="gap-2">
            <FadeInView delay={160 + gi * 30}>
              <Text className="text-xs font-bold uppercase tracking-wide text-muted">{group.label}</Text>
            </FadeInView>
            {group.items.map((session, i) => (
              <FadeInView key={session.id} delay={170 + gi * 30 + i * 40}>
                <SessionCard
                  session={session}
                  expanded={expandedId === session.id}
                  onPress={() => setExpandedId(expandedId === session.id ? null : session.id)}
                  onToggleDone={() => toggleCompleted(session.id)}
                  onEdit={() => openEditForm(session)}
                  onDuplicate={() => handleDuplicate(session)}
                  onDelete={() => confirmDelete(session)}
                />
              </FadeInView>
            ))}
          </View>
        ))
      )}

      {done.length > 0 ? (
        <>
          <FadeInView delay={220}>
            <Text className="mt-2 text-xl font-bold text-text">Passées</Text>
          </FadeInView>
          {doneGroups.map((group, gi) => (
            <View key={group.key} className="gap-2">
              <FadeInView delay={240 + gi * 20}>
                <Text className="text-xs font-bold uppercase tracking-wide text-muted">{group.label}</Text>
              </FadeInView>
              {group.items.map((session, i) => (
                <FadeInView key={session.id} delay={250 + gi * 20 + i * 30}>
                  <SessionCard
                    session={session}
                    expanded={expandedId === session.id}
                    onPress={() => setExpandedId(expandedId === session.id ? null : session.id)}
                    onToggleDone={() => toggleCompleted(session.id)}
                    onEdit={() => openEditForm(session)}
                    onDuplicate={() => handleDuplicate(session)}
                    onDelete={() => confirmDelete(session)}
                  />
                </FadeInView>
              ))}
            </View>
          ))}
        </>
      ) : null}
    </Screen>
    <PickerOverlaySlot />
    </>
  );
}
