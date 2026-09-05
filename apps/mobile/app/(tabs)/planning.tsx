import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { FadeInView } from "@/components/FadeInView";
import { CircularProgress } from "@/components/CircularProgress";
import { Screen } from "@/components/Screen";
import { Field } from "@/components/Field";
import { DatePickerField } from "@/components/DatePickerField";
import { TimePickerField } from "@/components/TimePickerField";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { RecurrenceField } from "@/components/RecurrenceField";
import { NEVER_RECURRENCE, computeRecurrenceDates, type Recurrence } from "@/lib/recurrence";
import { PrimaryButton } from "@/components/onboarding";
import { colors as staticColors } from "@/theme/colors";
import { useThemeColors } from "@/theme/ThemeProvider";
import { formatDuration, isSameDate, MONTHS } from "@/lib/dateFormat";
import { useHorses } from "@/horses/store";
import { useSubscription } from "@/subscription/store";
import { useAgenda, ACTIVITY_META, type ActivityType, type Appointment, type CompetitionEntry, type ExpenseCategory } from "@/agenda/store";
import { suggestedAppointmentFor as findSuggestedAppointment } from "@/agenda/meta";
import { useSessions, type SessionIntensity, type TrainingSession } from "@/sessions/store";
import {
  computeSessionStats,
  startOfMonth as statsMonthStart,
  endOfMonth as statsMonthEnd,
} from "@/sessions/stats";
import { ChipSelect, AddToggle } from "@/components/FormChips";
import { INTENSITY_META } from "@/sessions/components/SessionCard";
import {
  buildUnifiedEvents,
  filterUnifiedEvents,
  eventTime,
  isEventUpcoming,
  upcomingUnifiedEvents,
  PLANNING_FILTER_VALUES,
  type PlanningFilterValue,
  type UnifiedEvent,
} from "@/planning/unifiedEvents";
import { PlanningFilter } from "@/planning/components/PlanningFilter";
import { UnifiedEventCard } from "@/planning/components/UnifiedEventCard";
import { QuickAddSheet, type QuickAddOption } from "@/components/QuickAddSheet";
import { useAppointmentForm } from "@/agenda/hooks/useAppointmentForm";
import { AppointmentForm } from "@/agenda/components/AppointmentForm";
import { useExpenseForm } from "@/agenda/hooks/useExpenseForm";
import { ExpenseForm } from "@/agenda/components/ExpenseForm";
import { useJournalForm } from "@/agenda/hooks/useJournalForm";
import { JournalForm } from "@/agenda/components/JournalForm";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";
const DAY_SHORT = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];

const DURATION_OPTIONS = [30, 45, 60, 90];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Grille de 6 semaines (toujours 42 jours) commençant un lundi, incluant les
 * jours du mois précédent/suivant nécessaires pour compléter la première et
 * la dernière semaine — même convention "lundi = début de semaine" que
 * weekStart plus bas. */
function buildMonthGrid(monthCursor: Date): Date[] {
  const first = startOfMonth(monthCursor);
  const firstWeekday = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(gridStart.getDate() - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

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

type SessionForm = {
  activityType: ActivityType;
  date: Date | null;
  time: string;
  durationMinutes: number;
  intensity: SessionIntensity;
  notes: string;
  recurrence: Recurrence;
};

function emptyForm(): SessionForm {
  return {
    activityType: "dressage",
    date: new Date(),
    time: "",
    durationMinutes: 45,
    intensity: "medium",
    notes: "",
    recurrence: NEVER_RECURRENCE,
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
    recurrence: NEVER_RECURRENCE,
  };
}

const WEEKDAY_HEADER = ["L", "M", "M", "J", "V", "S", "D"];

function MonthGrid({
  monthCursor,
  selectedDay,
  onSelectDay,
  onChangeMonth,
  eventsByDay,
}: {
  monthCursor: Date;
  selectedDay: Date;
  onSelectDay: (d: Date) => void;
  onChangeMonth: (delta: number) => void;
  eventsByDay: Map<string, UnifiedEvent[]>;
}) {
  const colors = useThemeColors();
  const todayKey = new Date().toDateString();
  const days = buildMonthGrid(monthCursor);
  return (
    <View className={`${CARD} gap-3`}>
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-bold capitalize text-text">
          {MONTHS[monthCursor.getMonth()]} {monthCursor.getFullYear()}
        </Text>
        <View className="flex-row gap-1">
          <TouchableOpacity onPress={() => onChangeMonth(-1)} hitSlop={8} className="p-1.5">
            <MaterialCommunityIcons name="chevron-left" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onChangeMonth(1)} hitSlop={8} className="p-1.5">
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
      <View className="flex-row">
        {WEEKDAY_HEADER.map((w, i) => (
          <Text key={i} className="flex-1 text-center text-xs font-semibold uppercase text-muted">
            {w}
          </Text>
        ))}
      </View>
      <View className="flex-row flex-wrap">
        {days.map((d) => {
          const inMonth = d.getMonth() === monthCursor.getMonth();
          const isToday = d.toDateString() === todayKey;
          const isSelected = isSameDate(d, selectedDay);
          const dayEvents = eventsByDay.get(d.toDateString()) ?? [];
          return (
            <TouchableOpacity
              key={d.toDateString()}
              onPress={() => onSelectDay(d)}
              activeOpacity={0.7}
              className="w-[14.28%] items-center gap-1 py-1.5"
            >
              <View
                className={`h-8 w-8 items-center justify-center rounded-full ${
                  isSelected ? "bg-primary" : isToday ? "bg-highlight" : ""
                }`}
              >
                <Text
                  className={`text-sm ${!inMonth ? "text-border" : isSelected ? "font-bold text-on-primary" : "text-text"}`}
                >
                  {d.getDate()}
                </Text>
              </View>
              <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dayEvents.length > 0 ? colors.accent : "transparent" }} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function PlanningScreen() {
  const colors = useThemeColors();
  const { selectedHorse } = useHorses();
  const { isActiveOrTrialing } = useSubscription();
  const { sessions, addSession, updateSession, deleteSession, toggleCompleted } = useSessions();
  const {
    appointments,
    addAppointment,
    updateAppointment,
    deleteAppointment,
    saveResult,
    toggleChecklistItem,
    addChecklistItem,
    removeChecklistItem,
    addCompetitionEntry,
    updateCompetitionEntryResult,
    deleteCompetitionEntry,
    addExpense,
    updateExpense,
    addDocument,
    linkExpenseDocument,
    addJournalEntry,
    updateJournalEntry,
  } = useAgenda();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SessionForm>(emptyForm());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Filtre initial optionnel (cf. app/horse/[id]/entrainement.tsx et
  // concours.tsx, qui renvoient ici avec ?filter=... pour ouvrir directement
  // la bonne catégorie) — "all" par défaut si absent/invalide, comportement
  // inchangé pour toute navigation qui n'en passe pas.
  const { filter: filterParam, openForm: openFormParam } = useLocalSearchParams<{
    filter?: string;
    openForm?: string;
  }>();
  const initialFilter = PLANNING_FILTER_VALUES.includes(filterParam as PlanningFilterValue)
    ? (filterParam as PlanningFilterValue)
    : "all";
  const [filter, setFilter] = useState<PlanningFilterValue>(initialFilter);
  // Planning reste monté entre deux visites (comportement par défaut des
  // Tabs Expo Router) : sans cet ajustement, une deuxième navigation ici avec
  // un ?filter= différent (ex: Horse Hub > Entraînement après Horse Hub >
  // Concours) ne changerait rien, `useState(initialFilter)` ne s'exécutant
  // qu'au premier montage. Pattern "ajuster l'état pendant le rendu" plutôt
  // qu'un useEffect (cf. react.dev/learn/you-might-not-need-an-effect). Ne
  // touche rien si le paramètre est absent/invalide, pour ne pas écraser le
  // choix de l'utilisateur dans PlanningFilter.
  const [syncedFilterParam, setSyncedFilterParam] = useState(filterParam);
  if (filterParam !== syncedFilterParam) {
    setSyncedFilterParam(filterParam);
    if (PLANNING_FILTER_VALUES.includes(filterParam as PlanningFilterValue)) {
      setFilter(filterParam as PlanningFilterValue);
    }
  }
  // Même pattern que syncedFilterParam ci-dessus, pour Quick Add "Séance"
  // depuis Accueil/Horse Hub (cf. today.tsx et horse/[id]/index.tsx, qui
  // renvoient ici avec ?openForm=session) : ouvre directement le formulaire
  // de création de séance, déjà scoped au cheval actif (selectedHorse),
  // sans reproduire ce formulaire ailleurs.
  const [syncedOpenFormParam, setSyncedOpenFormParam] = useState(openFormParam);
  if (openFormParam !== syncedOpenFormParam) {
    setSyncedOpenFormParam(openFormParam);
    if (openFormParam === "session") {
      openCreateForm();
    }
  }
  const [viewMode, setViewMode] = useState<"list" | "month">("list");
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [showStats, setShowStats] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState<"month" | "all">("month");
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  // Seul le setter est nécessaire (cf. useAppointmentForm), Planning
  // n'affiche pas de bannière de permission notifications contrairement à
  // agenda.tsx.
  const [, setNotifPermission] = useState<boolean | null>(null);

  const horseSessions = sessions.filter((s) => s.horseId === selectedHorse?.id);
  const horseAppointments = appointments.filter((a) => a.horseId === selectedHorse?.id);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Statistiques simples (pas d'IA, cf. src/sessions/stats.ts) — "Toujours"
  // couvre depuis la plus ancienne séance du cheval jusqu'à aujourd'hui.
  // Restent volontairement propres aux séances (cf. brief §1 : chaque type
  // d'événement garde ses informations propres) — pas de "stats unifiées".
  const statsFrom =
    statsPeriod === "month"
      ? statsMonthStart(today)
      : horseSessions.reduce((min, s) => (s.date < min ? s.date : min), today);
  const statsTo = statsPeriod === "month" ? statsMonthEnd(today) : today;
  const sessionStats = computeSessionStats(horseSessions, statsFrom, statsTo);

  // Lundi de la semaine en cours, même convention que Today (0 = lundi).
  const weekOffset = (today.getDay() + 6) % 7;
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekSessions = horseSessions.filter((s) => s.date >= weekStart && s.date < weekEnd);
  const weekDone = weekSessions.filter((s) => s.completed).length;
  const weekMinutes = weekSessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

  // Unification d'affichage seulement (cf. plan Phase 3 Étape 3) : séances et
  // rendez-vous restent deux collections séparées côté store, buildUnifiedEvents
  // ne fait que les envelopper dans un type commun pour trier/regrouper/filtrer
  // une seule liste (cf. src/planning/unifiedEvents.ts).
  const unifiedEvents = buildUnifiedEvents(horseSessions, horseAppointments);
  const filteredEvents = filterUnifiedEvents(unifiedEvents, filter);

  // Vue mensuelle (cf. MonthGrid) : regroupe les événements déjà filtrés par
  // jour pour poser les puces de la grille et la liste du jour sélectionné.
  const eventsByDay = new Map<string, UnifiedEvent[]>();
  for (const e of filteredEvents) {
    const key = e.date.toDateString();
    eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), e]);
  }
  const selectedDayEvents = (eventsByDay.get(selectedDay.toDateString()) ?? []).sort((a, b) =>
    eventTime(a).localeCompare(eventTime(b))
  );

  const upcoming = upcomingUnifiedEvents(filteredEvents, todayStart);
  const done = filteredEvents
    .filter((e) => !isEventUpcoming(e, todayStart))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const upcomingGroups = groupByDay(upcoming);
  const doneGroups = groupByDay(done.slice(0, 20));

  const sessionHandlers = {
    onToggleDone: (s: TrainingSession) => toggleCompleted(s.id),
    onEdit: (s: TrainingSession) => openEditForm(s),
    onDuplicate: (s: TrainingSession) => handleDuplicate(s),
    onDelete: (s: TrainingSession) => confirmDelete(s),
  };

  // "Modifier" un rendez-vous depuis Planning renvoie vers Agenda plutôt que
  // d'ouvrir un formulaire d'édition ici — pas de deuxième formulaire
  // d'édition de rendez-vous à maintenir (cf. brief §8 : rester cohérent avec
  // les redirections déjà en place depuis le Horse Hub). Les autres actions
  // (checklist, résultat, épreuves, suppression) restent de simples appels
  // aux mutateurs déjà existants d'agenda/store.tsx, sans nouvelle logique.
  const appointmentHandlers = {
    onEdit: () => router.push("/(tabs)/agenda?section=appointments"),
    onDelete: (a: Appointment) => deleteAppointment(a),
    onSaveResult: (a: Appointment, result: string) => saveResult(a.id, result),
    onToggleChecklistItem: (a: Appointment, itemId: string) => toggleChecklistItem(a.id, itemId),
    onAddChecklistItem: (a: Appointment, label: string) => addChecklistItem(a.id, label),
    onRemoveChecklistItem: (a: Appointment, itemId: string) => removeChecklistItem(a.id, itemId),
    onAddCompetitionEntry: (a: Appointment, entry: Omit<CompetitionEntry, "id" | "result">) => addCompetitionEntry(a.id, entry),
    onUpdateCompetitionEntryResult: (a: Appointment, entryId: string, result: string) =>
      updateCompetitionEntryResult(a.id, entryId, result),
    onDeleteCompetitionEntry: (a: Appointment, entryId: string) => deleteCompetitionEntry(a.id, entryId),
  };

  const {
    showApptForm,
    setShowApptForm,
    apptForm,
    setApptForm,
    submittingAppt,
    editingApptId,
    cancelApptForm,
    handleSubmitAppointment,
    addApptFormEntry,
    updateApptFormEntry,
    removeApptFormEntry,
  } = useAppointmentForm({
    horse: selectedHorse ?? null,
    appointments,
    addAppointment,
    updateAppointment,
    isActiveOrTrialing,
    setNotifPermission,
    onEditStart: () => setExpandedId(null),
  });

  const {
    showExpenseForm,
    setShowExpenseForm,
    expenseForm,
    setExpenseForm,
    editingExpenseId,
    cancelExpenseForm,
    handleSubmitExpense,
    handlePickExpensePhoto,
  } = useExpenseForm({ addExpense, updateExpense, addDocument, linkExpenseDocument, isActiveOrTrialing });

  const {
    showJournalForm,
    setShowJournalForm,
    journalForm,
    setJournalForm,
    savingJournal,
    editingJournalId,
    cancelJournalForm,
    handleSubmitJournalEntry,
    handlePickJournalPhoto,
  } = useJournalForm({ addJournalEntry, updateJournalEntry, onEditStart: () => setExpandedId(null) });

  // Même logique de rapprochement que agenda.tsx/le Horse Hub — dupliquée
  // Suggestion de rapprochement pour le formulaire de dépense (cf.
  // agenda/meta.ts suggestedAppointmentFor, partagé avec today.tsx/Horse Hub).
  function suggestedAppointmentFor(category: ExpenseCategory): Appointment | null {
    return findSuggestedAppointment(horseAppointments, category);
  }

  function handleQuickAdd(option: QuickAddOption) {
    setQuickAddVisible(false);
    switch (option) {
      case "seance":
        openCreateForm();
        return;
      case "soin":
        setApptForm((f) => ({ ...f, type: "veto" }));
        setShowApptForm(true);
        return;
      case "rendezvous":
        setApptForm((f) => ({ ...f, type: "autre" }));
        setShowApptForm(true);
        return;
      case "concours":
        setApptForm((f) => ({ ...f, type: "concours" }));
        setShowApptForm(true);
        return;
      case "depense":
        setShowExpenseForm(true);
        return;
      case "journal":
        setShowJournalForm(true);
        return;
    }
  }

  function openCreateForm(date?: Date) {
    setEditingId(null);
    setForm(date ? { ...emptyForm(), date } : emptyForm());
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
      // form.recurrence "custom" : crée une séance identique à chaque date
      // calculée (cf. src/lib/recurrence.ts) — pas de notion de "série" liée
      // côté modèle, chaque occurrence est une TrainingSession indépendante
      // (éditable/supprimable une par une).
      for (const date of computeRecurrenceDates(form.date, form.recurrence)) {
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
          <Text className="text-3xl font-display tracking-tight text-text">Planning</Text>
          <Text className="text-base text-muted">La vie équestre de {selectedHorse?.name ?? "ton cheval"}, en un seul endroit</Text>
        </View>
      </FadeInView>

      <FadeInView delay={20}>
        <View className="flex-row gap-2 self-start rounded-full bg-surface p-1">
          {(["list", "month"] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => setViewMode(mode)}
              activeOpacity={0.85}
              className={`rounded-full px-4 py-1.5 ${viewMode === mode ? "bg-primary" : ""}`}
            >
              <Text className={`text-sm font-semibold ${viewMode === mode ? "text-on-primary" : "text-muted"}`}>
                {mode === "list" ? "Liste" : "Mois"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </FadeInView>

      {weekSessions.length > 0 ? (
        <FadeInView delay={40}>
          <View className="flex-row items-center gap-3 rounded-card bg-primary p-4">
            <CircularProgress
              progress={weekSessions.length > 0 ? weekDone / weekSessions.length : 0}
              size={44}
              strokeWidth={5}
              trackColor="rgba(255,255,255,0.25)"
              progressColor={colors.textOnPrimary}
            >
              <Text className="text-[11px] font-bold text-on-primary">
                {weekDone}/{weekSessions.length}
              </Text>
            </CircularProgress>
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-bold uppercase tracking-wide text-on-primary/80">Cette semaine</Text>
              <Text className="text-[15px] leading-5 text-on-primary">
                {weekDone} séance{weekDone > 1 ? "s" : ""} faite{weekDone > 1 ? "s" : ""} · {formatDuration(weekMinutes)} au
                programme
              </Text>
            </View>
          </View>
        </FadeInView>
      ) : null}

      <FadeInView delay={50}>
        <View className={CARD}>
          <TouchableOpacity
            onPress={() => setShowStats((v) => !v)}
            activeOpacity={0.8}
            className="flex-row items-center justify-between"
          >
            <Text className="text-base font-bold text-text">Statistiques</Text>
            <MaterialCommunityIcons
              name={showStats ? "chevron-up" : "chevron-down"}
              size={20}
              color={staticColors.textMuted}
            />
          </TouchableOpacity>

          {showStats ? (
            <View className="mt-4 gap-4 border-t border-border pt-4">
              <View className="flex-row gap-2 self-start rounded-full bg-background p-1">
                {(["month", "all"] as const).map((period) => (
                  <TouchableOpacity
                    key={period}
                    onPress={() => setStatsPeriod(period)}
                    activeOpacity={0.85}
                    className={`rounded-full px-3 py-1 ${statsPeriod === period ? "bg-primary" : ""}`}
                  >
                    <Text className={`text-xs font-semibold ${statsPeriod === period ? "text-on-primary" : "text-muted"}`}>
                      {period === "month" ? "Ce mois" : "Toujours"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {sessionStats.sessionCount === 0 && sessionStats.restDays === 0 ? (
                <Text className="text-sm text-muted">Aucune séance faite sur cette période.</Text>
              ) : (
                <>
                  <View className="flex-row items-center justify-between">
                    <View className="items-center gap-0.5">
                      <Text className="text-lg font-display text-text">{sessionStats.sessionCount}</Text>
                      <Text className="text-xs text-muted">séance{sessionStats.sessionCount > 1 ? "s" : ""}</Text>
                    </View>
                    <View className="items-center gap-0.5">
                      <Text className="text-lg font-display text-text">{formatDuration(sessionStats.totalMinutes)}</Text>
                      <Text className="text-xs text-muted">de travail</Text>
                    </View>
                    <View className="items-center gap-0.5">
                      <Text className="text-lg font-display text-text">{sessionStats.perWeek}</Text>
                      <Text className="text-xs text-muted">séance{sessionStats.perWeek > 1 ? "s" : ""}/sem.</Text>
                    </View>
                    <View className="items-center gap-0.5">
                      <Text className="text-lg font-display text-text">{sessionStats.restDays}</Text>
                      <Text className="text-xs text-muted">repos</Text>
                    </View>
                  </View>

                  {sessionStats.perDiscipline.length > 0 ? (
                    <View className="gap-1.5">
                      {sessionStats.perDiscipline.map(({ activityType, count }) => {
                        const meta = ACTIVITY_META[activityType];
                        return (
                          <View key={activityType} className="flex-row items-center gap-2.5">
                            <MaterialCommunityIcons name={meta.icon} size={15} color={meta.tint} />
                            <Text className="flex-1 text-sm text-text">{meta.label}</Text>
                            <Text className="text-sm font-semibold text-text">
                              {count} séance{count > 1 ? "s" : ""}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </>
              )}
            </View>
          ) : null}
        </View>
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
              <RecurrenceField
                value={form.recurrence}
                onChange={(recurrence) => setForm((f) => ({ ...f, recurrence }))}
              />
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
                  label={
                    editingId
                      ? "Enregistrer"
                      : form.recurrence.mode === "custom" &&
                          form.date &&
                          computeRecurrenceDates(form.date, form.recurrence).length > 1
                        ? `Ajouter (×${computeRecurrenceDates(form.date, form.recurrence).length})`
                        : "Ajouter"
                  }
                  disabled={!form.date}
                  onPress={handleSubmit}
                />
              </View>
            </View>
          </View>
        ) : showApptForm ? (
          <AppointmentForm
            show={showApptForm}
            form={apptForm}
            setForm={setApptForm}
            editingApptId={editingApptId}
            submitting={submittingAppt}
            onOpen={() => setShowApptForm(true)}
            onCancel={cancelApptForm}
            onSubmit={handleSubmitAppointment}
            onAddEntry={addApptFormEntry}
            onUpdateEntry={updateApptFormEntry}
            onRemoveEntry={removeApptFormEntry}
          />
        ) : showExpenseForm ? (
          <ExpenseForm
            show={showExpenseForm}
            form={expenseForm}
            setForm={setExpenseForm}
            editingExpenseId={editingExpenseId}
            suggestedAppointmentFor={suggestedAppointmentFor}
            onOpen={() => setShowExpenseForm(true)}
            onCancel={cancelExpenseForm}
            onSubmit={handleSubmitExpense}
            onPickPhoto={handlePickExpensePhoto}
          />
        ) : showJournalForm ? (
          <JournalForm
            show={showJournalForm}
            form={journalForm}
            setForm={setJournalForm}
            editingJournalId={editingJournalId}
            saving={savingJournal}
            onOpen={() => setShowJournalForm(true)}
            onCancel={cancelJournalForm}
            onSubmit={handleSubmitJournalEntry}
            onPickPhoto={handlePickJournalPhoto}
          />
        ) : (
          <AddToggle label="Ajouter" onPress={() => setQuickAddVisible(true)} color={colors.primary} />
        )}
      </FadeInView>

      {!showForm && !showApptForm && !showExpenseForm && !showJournalForm && unifiedEvents.length > 0 ? (
        <FadeInView delay={90}>
          <PlanningFilter value={filter} onChange={setFilter} />
        </FadeInView>
      ) : null}

      {viewMode === "month" ? (
        <>
          <FadeInView delay={120}>
            <MonthGrid
              monthCursor={monthCursor}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              onChangeMonth={(delta) => {
                const next = addMonths(monthCursor, delta);
                setMonthCursor(next);
                setSelectedDay((d) => (d.getMonth() === next.getMonth() ? d : next));
              }}
              eventsByDay={eventsByDay}
            />
          </FadeInView>

          <FadeInView delay={160}>
            <Text className="text-xl font-bold text-text">{dayHeaderLabel(selectedDay)}</Text>
          </FadeInView>

          {selectedDayEvents.length === 0 ? (
            <FadeInView delay={190}>
              <AddToggle label="Planifier une séance ce jour" onPress={() => openCreateForm(selectedDay)} color={colors.primary} />
            </FadeInView>
          ) : (
            selectedDayEvents.map((event, i) => (
              <FadeInView key={event.id} delay={190 + i * 40}>
                <UnifiedEventCard
                  event={event}
                  expanded={expandedId === event.id}
                  onToggleExpand={() => setExpandedId(expandedId === event.id ? null : event.id)}
                  sessionHandlers={sessionHandlers}
                  appointmentHandlers={appointmentHandlers}
                />
              </FadeInView>
            ))
          )}
        </>
      ) : (
        <>
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
                  {filter === "all" ? "Rien de planifié." : "Rien de ce type à venir."}
                </Text>
              </View>
            </FadeInView>
          ) : (
            upcomingGroups.map((group, gi) => (
              <View key={group.key} className="gap-2">
                <FadeInView delay={160 + gi * 30}>
                  <Text className="text-xs font-bold uppercase tracking-wide text-muted">{group.label}</Text>
                </FadeInView>
                {group.items.map((event, i) => (
                  <FadeInView key={event.id} delay={170 + gi * 30 + i * 40}>
                    <UnifiedEventCard
                      event={event}
                      expanded={expandedId === event.id}
                      onToggleExpand={() => setExpandedId(expandedId === event.id ? null : event.id)}
                      sessionHandlers={sessionHandlers}
                      appointmentHandlers={appointmentHandlers}
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
                  {group.items.map((event, i) => (
                    <FadeInView key={event.id} delay={250 + gi * 20 + i * 30}>
                      <UnifiedEventCard
                        event={event}
                        expanded={expandedId === event.id}
                        onToggleExpand={() => setExpandedId(expandedId === event.id ? null : event.id)}
                        sessionHandlers={sessionHandlers}
                        appointmentHandlers={appointmentHandlers}
                      />
                    </FadeInView>
                  ))}
                </View>
              ))}
            </>
          ) : null}
        </>
      )}
    </Screen>
    <PickerOverlaySlot />
    <QuickAddSheet visible={quickAddVisible} onClose={() => setQuickAddVisible(false)} onSelect={handleQuickAdd} />
    </>
  );
}
