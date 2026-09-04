import { useEffect, useState } from "react";
import { Alert, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { pushWidgetData } from "@/lib/widgetKit";
import { scheduleWeeklySummary } from "@/lib/notifications";
import { FadeInView } from "@/components/FadeInView";
import { WeatherForecastStrip } from "@/components/WeatherForecastStrip";
import { CircularProgress } from "@/components/CircularProgress";
import { Screen } from "@/components/Screen";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { useThemeColors } from "@/theme/ThemeProvider";
import { MONTHS, isSameDate } from "@/lib/dateFormat";
import { restDayActivityFor, useHorses } from "@/horses/store";
import { useSessions } from "@/sessions/store";
import { useAgenda, ACTIVITY_META, type Appointment, type ExpenseCategory } from "@/agenda/store";
import { APPT_META, suggestedAppointmentFor as findSuggestedAppointment } from "@/agenda/meta";
import { maxHorses, useSubscription } from "@/subscription/store";
import {
  buildUnifiedEvents,
  upcomingUnifiedEvents,
  eventTime,
  type UnifiedEvent,
} from "@/planning/unifiedEvents";
import { buildHorseAlerts } from "@/horses/alerts";
import { QuickAddSheet, type QuickAddOption } from "@/components/QuickAddSheet";
import { useAppointmentForm } from "@/agenda/hooks/useAppointmentForm";
import { AppointmentForm } from "@/agenda/components/AppointmentForm";
import { useExpenseForm } from "@/agenda/hooks/useExpenseForm";
import { ExpenseForm } from "@/agenda/components/ExpenseForm";
import { useJournalForm } from "@/agenda/hooks/useJournalForm";
import { JournalForm } from "@/agenda/components/JournalForm";

const TIPS = [
  "Varie les allures à l'échauffement pour mieux préparer les muscles de ton cheval.",
  "Un debrief de 2 minutes après la séance aide à mémoriser les progrès.",
  "Étire ton cheval en fin de séance pour limiter les courbatures.",
  "Mieux vaut une séance courte et régulière qu'une longue séance espacée.",
];

const DAY_SHORT_BY_GETDAY = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];

function formatWhen(date: Date, time?: string): string {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const suffix = time ? ` · ${time}` : "";
  if (isSameDate(date, todayStart)) return `Aujourd'hui${suffix}`;
  if (isSameDate(date, tomorrowStart)) return `Demain${suffix}`;
  return `${DAY_SHORT_BY_GETDAY[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}${suffix}`;
}

/** Icône/couleur/titre d'un événement unifié pour la carte "Prochains
 * événements" — dérivés d'ACTIVITY_META/APPT_META (déjà la source de
 * vérité utilisée par Planning et le Horse Hub), pas d'une table de
 * correspondance locale dupliquée comme avant (cf. plan Phase 3 Étape 4). */
function upcomingEventMeta(event: UnifiedEvent): {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  chip: string;
  tint: string;
  tag: string;
  label: string;
  title: string;
} {
  if (event.kind === "session") {
    const meta = ACTIVITY_META[event.session.activityType];
    return { icon: meta.icon, chip: meta.chip, tint: meta.tint, tag: "text-primary", label: "Séance", title: meta.label };
  }
  const meta = APPT_META[event.appointment.type];
  return {
    icon: meta.icon.name,
    chip: meta.chip,
    tint: meta.icon.color,
    tag: meta.tag,
    label: meta.label,
    title: event.appointment.title || meta.label,
  };
}

// Carte blanche standard, réutilisée tel quel
const CARD = "rounded-card bg-surface p-5 shadow-card";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function dailyTip(): string {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.now() - start.getTime()) / 86_400_000);
  return TIPS[dayOfYear % TIPS.length];
}

function weeklyRecapMessage(done: number, total: number): string {
  if (total === 0) return "Aucune séance planifiée cette semaine.";
  if (done === 0) return "La semaine commence — à toi de planifier la première séance !";
  if (done === total) return `Semaine parfaite ! Les ${total} séances planifiées sont faites. 🎉`;
  return `${done}/${total} séances faites cette semaine. Encore ${total - done} pour finir en beauté.`;
}

export default function TodayScreen() {
  const colors = useThemeColors();
  const { horses, selectedHorse, selectHorse } = useHorses();
  const { sessions, toggleCompleted } = useSessions();
  const {
    appointments,
    addAppointment,
    updateAppointment,
    addExpense,
    updateExpense,
    addDocument,
    linkExpenseDocument,
    addJournalEntry,
    updateJournalEntry,
  } = useAgenda();
  const subscription = useSubscription();
  const { isActiveOrTrialing } = subscription;
  const horseLimit = maxHorses(subscription);
  const ownedHorseIds = horses.filter((h) => !h.sharedRole).map((h) => h.id);
  const horse = selectedHorse;

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // 0 = lundi ... 6 = dimanche (même convention qu'ailleurs dans l'app).
  const todayDayOffset = (today.getDay() + 6) % 7;

  const horseSessions = sessions.filter((s) => s.horseId === horse?.id);
  const todaySession = horseSessions.find((s) => isSameDate(s.date, todayStart)) ?? null;

  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - todayDayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekSessions = horseSessions.filter((s) => s.date >= weekStart && s.date < weekEnd);
  const weekDoneCount = weekSessions.filter((s) => s.completed).length;

  // "Prochains événements" : séances + rendez-vous du cheval actif fusionnés
  // par le même système que Planning (cf. plan Phase 3 Étape 3) — aucune
  // deuxième logique de calendrier, juste les 3 premiers ici.
  const horseAppointments = appointments.filter((a) => a.horseId === horse?.id);
  const upcoming = upcomingUnifiedEvents(buildUnifiedEvents(horseSessions, horseAppointments), todayStart).slice(0, 3);

  // Alertes (cf. plan Phase 3 Étape 4 §6) : toutes les écuries, pas
  // seulement le cheval actif — une alerte peut concerner un autre cheval.
  const alerts = buildHorseAlerts(horses, appointments, todayStart);

  // Synchronise le widget iOS dès que les données de la journée changent —
  // best-effort, silencieux hors iOS/EAS build (actuellement no-op, cf.
  // lib/widgetKit.ts).
  useEffect(() => {
    pushWidgetData({
      horseName: horse?.name ?? "Mon cheval",
      todaySessionTitle: todaySession ? ACTIVITY_META[todaySession.activityType].label : null,
      todaySessionDurationMin: todaySession?.durationMinutes ?? null,
      todaySessionTime: todaySession?.time ?? null,
      weeklyDone: weekDoneCount,
      weeklyTotal: weekSessions.length,
    });
  }, [horse?.id, todaySession, weekDoneCount, weekSessions.length]);

  // Programme le bilan du dimanche soir une fois par semaine.
  useEffect(() => {
    if (!horse) return;
    scheduleWeeklySummary(horse.name, weekDoneCount, weekSessions.length);
  }, [horse?.id, weekDoneCount, weekSessions.length]);

  // Ajout rapide (cf. plan Phase 3 Étape 4 §9) — mêmes hooks/formulaires que
  // Planning et le Horse Hub, rattachement automatique au cheval actif via
  // le mécanisme global existant (aucune deuxième logique de sélection).
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [, setNotifPermission] = useState<boolean | null>(null);

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
    horse: horse ?? null,
    appointments,
    addAppointment,
    updateAppointment,
    isActiveOrTrialing,
    setNotifPermission,
    onEditStart: () => {},
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
  } = useJournalForm({ addJournalEntry, updateJournalEntry, onEditStart: () => {} });

  // Suggestion de rapprochement pour le formulaire de dépense (cf.
  // agenda/meta.ts suggestedAppointmentFor, partagé avec planning.tsx/Horse Hub).
  function suggestedAppointmentFor(category: ExpenseCategory): Appointment | null {
    return findSuggestedAppointment(horseAppointments, category);
  }

  function handleQuickAdd(option: QuickAddOption) {
    setQuickAddVisible(false);
    switch (option) {
      case "seance":
        // Pas de formulaire de séance natif sur Accueil (cf. planning.tsx) —
        // même choix que le Horse Hub, pour ne pas dupliquer ce formulaire.
        router.push("/(tabs)/planning");
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

  return (
    <>
    <Screen>
      {/* En-tête */}
      <FadeInView>
        <View className="gap-4 rounded-card bg-primary p-5">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 gap-0.5 pr-3">
              <Text className="text-2xl font-display tracking-tight text-on-primary">{greeting()}</Text>
              <Text className="text-[15px] text-on-primary/80">
                Prêt pour une séance avec {horse?.name ?? "ton cheval"} ?
              </Text>
            </View>
            <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-on-primary/15">
              {horse?.photoUrl ? (
                <Image source={{ uri: horse.photoUrl }} className="h-14 w-14" />
              ) : (
                <MaterialCommunityIcons name="horse-variant" size={26} color={colors.textOnPrimary} />
              )}
            </View>
          </View>

          {/* Bilan de la semaine — anneau animé, généré à partir des vraies séances cochées */}
          <View className="flex-row items-center gap-3 rounded-card bg-on-primary/10 p-3">
            <CircularProgress
              progress={weekSessions.length > 0 ? weekDoneCount / weekSessions.length : 0}
              size={44}
              strokeWidth={5}
              trackColor="rgba(255,255,255,0.25)"
              progressColor={colors.textOnPrimary}
            >
              <Text className="text-[11px] font-bold text-on-primary">
                {weekDoneCount}/{weekSessions.length}
              </Text>
            </CircularProgress>
            <Text className="flex-1 text-[13px] leading-[17px] text-on-primary/90">
              {weeklyRecapMessage(weekDoneCount, weekSessions.length)}
            </Text>
          </View>
        </View>
      </FadeInView>

      {/* Météo des prochains jours — purement indicatif, masqué si indisponible */}
      <FadeInView delay={20}>
        <WeatherForecastStrip />
      </FadeInView>

      {/* Sélecteur de cheval — visible seulement à partir de 2 chevaux dans l'écurie */}
      {horses.length > 1 ? (
        <FadeInView delay={40}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pr-2">
            {horses.map((h) => {
              const isSelected = h.id === horse?.id;
              // Les chevaux partagés (DP/coach) ne comptent jamais dans le
              // quota du palier — seul leur rang parmi les chevaux POSSÉDÉS
              // compte pour le verrouillage (cf. profile.tsx, même logique).
              const locked = !h.sharedRole && ownedHorseIds.indexOf(h.id) >= horseLimit;
              return (
                <TouchableOpacity
                  key={h.id}
                  onPress={() => (locked ? router.push("/paywall") : selectHorse(h.id))}
                  activeOpacity={0.8}
                  className="items-center gap-1"
                >
                  <View
                    className={`relative h-14 w-14 items-center justify-center overflow-hidden rounded-full ${
                      isSelected ? "border-2 border-primary bg-highlight" : "border border-border bg-surface"
                    } ${locked ? "opacity-40" : ""}`}
                  >
                    {h.photoUrl ? (
                      <Image source={{ uri: h.photoUrl }} className="h-14 w-14" />
                    ) : (
                      <MaterialCommunityIcons
                        name="horse-variant"
                        size={24}
                        color={isSelected ? colors.primary : colors.textMuted}
                      />
                    )}
                    {locked ? (
                      <View className="absolute inset-0 items-center justify-center bg-surface/50">
                        <Text className="text-sm">🔒</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    className={`max-w-[64px] text-center text-xs font-semibold ${
                      isSelected ? "text-primary" : "text-muted"
                    }`}
                    numberOfLines={1}
                  >
                    {h.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </FadeInView>
      ) : null}

      {/* Alertes — échéance santé < 14j ou concours < 7j, tous chevaux
          confondus (cf. plan Phase 3 Étape 4 §6) ; rien affiché si aucune
          alerte ne s'applique, pas d'espace réservé. */}
      {alerts.length > 0 ? (
        <FadeInView delay={60}>
          <View className={`${CARD} gap-2`}>
            <View className="flex-row items-center gap-1.5">
              <MaterialCommunityIcons name="bell-alert-outline" size={16} color={colors.warning} />
              <Text className="text-xs font-bold uppercase tracking-wide text-warning">À surveiller</Text>
            </View>
            {alerts.map((alert) => (
              <TouchableOpacity
                key={alert.horseId}
                onPress={() => {
                  selectHorse(alert.horseId);
                  router.push(`/horse/${alert.horseId}`);
                }}
                activeOpacity={0.7}
                className="flex-row items-center gap-2"
              >
                <MaterialCommunityIcons
                  name={alert.kind === "health" ? "heart-pulse" : "trophy-outline"}
                  size={15}
                  color={alert.kind === "health" ? colors.warning : colors.accent}
                />
                <Text className="flex-1 text-sm text-text">
                  <Text className="font-semibold">{alert.horseName}</Text> · {alert.message}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </FadeInView>
      ) : null}

      {/* CTA rapide — séance du jour ou planification */}
      <FadeInView delay={80}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            if (todaySession) {
              toggleCompleted(todaySession.id);
            } else {
              const activity = horse ? restDayActivityFor(horse, todayDayOffset) : null;
              Alert.alert(
                "Aucune séance aujourd'hui",
                activity && horse
                  ? `Rien de planifié aujourd'hui. ${horse.name} : ${activity.toLowerCase()}.`
                  : "Rien de planifié aujourd'hui — ajoute une séance depuis Planning."
              );
            }
          }}
          className="flex-row items-center justify-center gap-2 rounded-card bg-primary p-4"
        >
          <Text className="text-base font-bold text-on-primary">
            {todaySession
              ? todaySession.completed
                ? "Séance du jour marquée faite ✓"
                : "Marquer la séance du jour comme faite"
              : "Planifier une séance"}
          </Text>
        </TouchableOpacity>
      </FadeInView>

      {/* Conseil du jour — teinté pour se distinguer des cartes neutres ci-dessous */}
      <FadeInView delay={160}>
        <View className="flex-row gap-3 rounded-card bg-highlight p-5">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
            <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color={colors.primary} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-bold uppercase tracking-wide text-primary">
              Conseil du jour
            </Text>
            <Text className="text-[15px] leading-5 text-text">{dailyTip()}</Text>
          </View>
        </View>
      </FadeInView>

      {/* Prochains événements — planning unifié (cf. plan Phase 3 Étape 3),
          pas de deuxième logique de calendrier. */}
      <FadeInView delay={200}>
        <View className="mt-1 flex-row items-center justify-between">
          <Text className="text-xl font-bold text-text">Prochains événements</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/planning")}>
            <Text className="text-sm font-semibold text-accent">Voir tout</Text>
          </TouchableOpacity>
        </View>
      </FadeInView>

      <FadeInView delay={240}>
        {upcoming.length === 0 ? (
          <View className={`${CARD} items-center gap-2`}>
            <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
              <MaterialCommunityIcons name="calendar-blank-outline" size={22} color={colors.textMuted} />
            </View>
            <Text className="text-sm text-muted">Rien de prévu pour l&apos;instant.</Text>
          </View>
        ) : (
          <View className={CARD}>
            {upcoming.map((event, i) => {
              const meta = upcomingEventMeta(event);
              const when = formatWhen(event.date, eventTime(event));
              return (
                <TouchableOpacity
                  key={event.id}
                  onPress={() => router.push("/(tabs)/planning")}
                  activeOpacity={0.7}
                  className={`flex-row items-center gap-3 py-3.5 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <View className={`h-9 w-9 items-center justify-center rounded-full ${meta.chip}`}>
                    <MaterialCommunityIcons name={meta.icon} size={18} color={meta.tint} />
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className="text-[15px] font-semibold text-text">{meta.title}</Text>
                    <Text className="text-sm text-muted">{when}</Text>
                  </View>
                  <Text className={`text-xs font-bold ${meta.tag}`}>{meta.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </FadeInView>

      {/* Ajout rapide (cf. plan Phase 3 Étape 4 §9) — le déclencheur cède la
          place au formulaire ouvert, même principe que Planning/Horse Hub
          (jamais les deux affichés en même temps). */}
      <FadeInView delay={260}>
        {showApptForm ? (
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
          />
        ) : (
          <TouchableOpacity
            onPress={() => setQuickAddVisible(true)}
            activeOpacity={0.85}
            className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-primary p-4"
          >
            <MaterialCommunityIcons name="plus" size={18} color={colors.primary} />
            <Text className="text-base font-semibold text-primary">Ajouter</Text>
          </TouchableOpacity>
        )}
      </FadeInView>
    </Screen>
    <QuickAddSheet visible={quickAddVisible} onClose={() => setQuickAddVisible(false)} onSelect={handleQuickAdd} />
    <PickerOverlaySlot />
    </>
  );
}
