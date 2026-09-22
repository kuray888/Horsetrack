import { useEffect, useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "@/components/AppImage";
import { pushWidgetData } from "@/lib/widgetKit";
import { ensureNotificationPermission, getNotificationStatus, scheduleWeeklySummary } from "@/lib/notifications";
import { FadeInView } from "@/components/FadeInView";
import { WeatherForecastStrip } from "@/components/WeatherForecastStrip";
import { CircularProgress } from "@/components/CircularProgress";
import { Screen } from "@/components/Screen";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { useThemeColors } from "@/theme/ThemeProvider";
import { MONTHS, isSameDate } from "@/lib/dateFormat";
import { useHorses } from "@/horses/store";
import { useSessions } from "@/sessions/store";
import { useAgenda, ACTIVITY_META, type Appointment, type ExpenseCategory } from "@/agenda/store";
import { APPT_META, suggestedAppointmentFor as findSuggestedAppointment } from "@/agenda/meta";
import { useSubscription } from "@/subscription/store";
import { HorseSwitcher } from "@/horses/components/HorseSwitcher";
import {
  buildUnifiedEvents,
  upcomingUnifiedEvents,
  eventTime,
  type UnifiedEvent,
} from "@/planning/unifiedEvents";
import { buildHorseAlerts } from "@/horses/alerts";
import { usePendingSyncCount } from "@/lib/useSyncQueue";
import { retryPendingWrites } from "@/lib/cloudSync";
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
    return {
      icon: meta.icon,
      chip: meta.chip,
      tint: meta.tint,
      tag: "text-primary",
      label: "Séance",
      title: event.session.customActivityLabel || meta.label,
    };
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
  const { horses, selectedHorse } = useHorses();
  const { sessions, toggleCompleted } = useSessions();
  const {
    appointments,
    saveFailed,
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
  // Écritures cloud en attente d'un retour du réseau (cf. lib/syncQueue.ts).
  const pendingSync = usePendingSyncCount();
  /** Permission de notification refusée : les rappels sont enregistrés mais
   * ne s'afficheront jamais. Cette bannière vivait dans l'écran Agenda,
   * supprimé — sans elle, plus rien ne signalait que des rappels programmés
   * ne sonneraient pas.
   *
   * `getNotificationStatus` LIT l'état sans le demander, contrairement à
   * l'ancien écran qui appelait `ensureNotificationPermission` au montage :
   * l'Accueil étant le premier écran de l'app, cela aurait déclenché la
   * demande système dès le lancement. La demande ne part que sur appui du
   * bouton « Activer ». */
  const [notifPermission, setNotifPermission] = useState<boolean | null>(null);
  useEffect(() => {
    getNotificationStatus()
      .then(setNotifPermission)
      .catch(() => setNotifPermission(null));
  }, []);
  const horse = selectedHorse;

  // Une seule fois par montage, pas à chaque render (cf. audit perf du
  // 2026-09-09) : "aujourd'hui" ne change de toute façon pas au sein d'une
  // même session d'app, un `new Date()` frais à chaque render ne ferait que
  // casser toute mémoïsation en aval sans rien apporter.
  const today = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()), [today]);
  // 0 = lundi ... 6 = dimanche (même convention qu'ailleurs dans l'app).
  const todayDayOffset = useMemo(() => (today.getDay() + 6) % 7, [today]);

  const horseSessions = useMemo(() => sessions.filter((s) => s.horseId === horse?.id), [sessions, horse?.id]);
  const todaySession = useMemo(
    () => horseSessions.find((s) => isSameDate(s.date, todayStart)) ?? null,
    [horseSessions, todayStart]
  );

  const weekStart = useMemo(() => {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - todayDayOffset);
    return d;
  }, [todayStart, todayDayOffset]);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    return d;
  }, [weekStart]);
  const weekSessions = useMemo(
    () => horseSessions.filter((s) => s.date >= weekStart && s.date < weekEnd),
    [horseSessions, weekStart, weekEnd]
  );
  const weekDoneCount = useMemo(() => weekSessions.filter((s) => s.completed).length, [weekSessions]);

  // "Prochains événements" : séances + rendez-vous du cheval actif fusionnés
  // par le même système que Planning (cf. plan Phase 3 Étape 3) — aucune
  // deuxième logique de calendrier, juste les 3 premiers ici.
  const horseAppointments = useMemo(
    () => appointments.filter((a) => a.horseId === horse?.id),
    [appointments, horse?.id]
  );
  const upcoming = useMemo(
    () => upcomingUnifiedEvents(buildUnifiedEvents(horseSessions, horseAppointments), todayStart),
    [horseSessions, horseAppointments, todayStart]
  );
  // Le même événement ne doit apparaître qu'à un seul endroit : ce qui tombe
  // aujourd'hui vit dans le bloc « Aujourd'hui » (où il est actionnable), le
  // reste dans « Prochainement ». Avant, la séance du jour s'affichait à la
  // fois dans le bouton d'action et dans la liste des prochains événements.
  const todayEvents = useMemo(() => upcoming.filter((e) => isSameDate(e.date, todayStart)), [upcoming, todayStart]);
  const laterEvents = useMemo(
    () => upcoming.filter((e) => !isSameDate(e.date, todayStart)).slice(0, 3),
    [upcoming, todayStart]
  );
  /** Première échéance à venir, tous chevaux confondus — sert à l'état vide :
   * « rien aujourd'hui » ne veut pas dire « rien à faire », et une journée
   * libre est justement le moment où l'on veut voir ce qui arrive ensuite. */
  const nextEvent = laterEvents[0] ?? null;

  // Alertes (cf. plan Phase 3 Étape 4 §6) : toutes les écuries, pas
  // seulement le cheval actif — une alerte peut concerner un autre cheval.
  const alerts = useMemo(() => buildHorseAlerts(horses, appointments, todayStart), [horses, appointments, todayStart]);

  // Synchronise le widget iOS dès que les données de la journée changent —
  // best-effort, silencieux hors iOS/EAS build (actuellement no-op, cf.
  // lib/widgetKit.ts).
  useEffect(() => {
    pushWidgetData({
      horseName: horse?.name ?? "Mon cheval",
      todaySessionTitle: todaySession
        ? todaySession.customActivityLabel || ACTIVITY_META[todaySession.activityType].label
        : null,
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
  // `setNotifPermission` est celui déclaré plus haut avec la bannière : quand
  // la programmation d'un rappel échoue (permission révoquée entre-temps),
  // useAppointmentForm le passe à `false` et la bannière apparaît aussitôt.

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
  } = useExpenseForm({
    addExpense,
    updateExpense,
    addDocument,
    linkExpenseDocument,
    isActiveOrTrialing,
    // Explicitement le cheval affiché par cet écran, plutôt que de laisser le
    // store retomber sur le cheval actif : c'est le même ici, mais le dire
    // garde le rattachement lisible depuis l'écran (cf. HorseTargetNotice).
    horse: horse ?? null,
  });

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
  } = useJournalForm({ addJournalEntry, updateJournalEntry, horse: horse ?? null, onEditStart: () => {} });

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
        // ?openForm=session ouvre directement le formulaire de création dans
        // Planning, déjà scoped au cheval actif (selectedHorse global). `ts`
        // rend chaque appui unique (cf. son commentaire dans planning.tsx) :
        // sans lui, un deuxième appui avec la même valeur "session" ne
        // rouvrait pas le formulaire si Planning était déjà resté monté avec
        // ce paramètre depuis la visite précédente (cf. audit crash du
        // 2026-09-05, Bug 1).
        router.push({ pathname: "/(tabs)/planning", params: { openForm: "session", ts: String(Date.now()) } });
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
                <Image source={{ uri: horse.photoUrl }} style={{ width: 56, height: 56 }} />
              ) : (
                <MaterialCommunityIcons name="horse-variant" size={26} color={colors.textOnPrimary} />
              )}
            </View>
          </View>

        </View>
      </FadeInView>

      {/* Sélecteur de cheval — visible seulement à partir de 2 chevaux dans
          l'écurie (cf. HorseSwitcher, même composant sur Planning/Agenda). */}
      {horses.length > 1 ? (
        <FadeInView delay={40}>
          <HorseSwitcher />
        </FadeInView>
      ) : null}

      {/* Sauvegarde locale en échec (disque plein, fichier inaccessible) —
          au-dessus de tout le reste : tant que ça dure, rien de ce qui est
          saisi ne survivra à la fermeture de l'app. L'alerte de
          lib/localStore.ts ne passe qu'une fois par session ; cette bannière,
          elle, reste tant que le problème dure. */}
      {saveFailed ? (
        <FadeInView delay={50}>
          <View className="flex-row items-center gap-2.5 rounded-card bg-danger/15 p-3.5">
            <MaterialCommunityIcons name="content-save-off-outline" size={18} color={colors.danger} />
            <Text className="flex-1 text-sm text-text">
              Tes dernières modifications n&apos;ont pas pu être enregistrées sur cet appareil. Vérifie l&apos;espace de
              stockage disponible.
            </Text>
          </View>
        </FadeInView>
      ) : null}

      {/* Sauvegarde cloud en retard — dit ce qui n'est PAS encore parti,
          plutôt que de laisser croire que tout est à l'abri. Les données sont
          bien enregistrées sur l'appareil : c'est une information, pas une
          alerte, d'où le ton et la couleur plus calmes que la bannière
          ci-dessus. La reprise est automatique (démarrage, retour au premier
          plan) ; le bouton permet juste de ne pas attendre. */}
      {pendingSync > 0 ? (
        <FadeInView delay={55}>
          <View className="flex-row items-center gap-2.5 rounded-card bg-warning/15 p-3.5">
            <MaterialCommunityIcons name="cloud-sync-outline" size={18} color={colors.warning} />
            <Text className="flex-1 text-sm text-text">
              {pendingSync === 1
                ? "1 modification enregistrée sur cet appareil attend la sauvegarde en ligne."
                : `${pendingSync} modifications enregistrées sur cet appareil attendent la sauvegarde en ligne.`}
            </Text>
            <TouchableOpacity onPress={() => retryPendingWrites().catch(() => {})} hitSlop={8}>
              <Text className="text-sm font-bold text-warning">Réessayer</Text>
            </TouchableOpacity>
          </View>
        </FadeInView>
      ) : null}

      {notifPermission === false ? (
        <FadeInView delay={58}>
          <View className={`${CARD} flex-row items-center gap-3`}>
            <MaterialCommunityIcons name="bell-off-outline" size={20} color={colors.textMuted} />
            <Text className="flex-1 text-sm text-muted">
              Notifications désactivées : tes rappels seront enregistrés mais ne s&apos;afficheront pas sur ton
              téléphone.
            </Text>
            <TouchableOpacity
              onPress={() =>
                ensureNotificationPermission()
                  .then(setNotifPermission)
                  .catch(() => {})
              }
              activeOpacity={0.7}
              hitSlop={8}
            >
              <Text className="text-sm font-bold text-accent">Activer</Text>
            </TouchableOpacity>
          </View>
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
                onPress={() =>
                  // Consulter l'alerte d'un autre cheval ne change pas le
                  // cheval actif : c'était le cas le plus visible du recadrage
                  // silencieux (on revenait sur un Accueil qui parlait d'un
                  // autre cheval), et les écrans de destination se suffisent
                  // désormais à eux-mêmes (cf. app/horse/[id]/index.tsx).
                  // Une blessure en cours se suit dans Santé (bouton "Marquer
                  // comme rétablie") plutôt que dans la fiche générale.
                  router.push(alert.kind === "injury" ? `/horse/${alert.horseId}/sante` : `/horse/${alert.horseId}`)
                }
                activeOpacity={0.7}
                className="flex-row items-center gap-2"
              >
                <MaterialCommunityIcons
                  name={alert.kind === "health" ? "heart-pulse" : alert.kind === "injury" ? "bandage" : "trophy-outline"}
                  size={15}
                  color={alert.kind === "concours" ? colors.accent : colors.warning}
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

      {/* Aujourd'hui — ce qui tombe dans la journée, actionnable sur place
          (une séance se coche d'ici, cf. toggleCompleted) plutôt que renvoyé
          au Planning. Chaque événement n'apparaît qu'ici, jamais aussi dans
          « Prochainement » (cf. todayEvents/laterEvents). */}
      <FadeInView delay={80}>
        <View className="mt-1 flex-row items-center justify-between">
          <Text className="text-xl font-bold text-text">Aujourd&apos;hui</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/planning")}>
            <Text className="text-sm font-semibold text-accent">Voir le planning</Text>
          </TouchableOpacity>
        </View>
      </FadeInView>

      <FadeInView delay={100}>
        {todayEvents.length === 0 ? (
          <View className={`${CARD} gap-1.5`}>
            <Text className="text-[15px] font-semibold text-text">Rien de prévu aujourd&apos;hui.</Text>
            {/* « Rien de prévu » n'est pas « tout est à jour » : on dit ce qui
                attend quand même, plutôt que de laisser une carte vide qui se
                lit comme un feu vert. */}
            <Text className="text-sm leading-5 text-muted">
              {alerts.length > 0
                ? `${alerts.length} point${alerts.length > 1 ? "s" : ""} à surveiller plus haut${
                    nextEvent ? `, et ${formatWhen(nextEvent.date).toLowerCase()} : ${upcomingEventMeta(nextEvent).title}` : ""
                  }.`
                : nextEvent
                  ? `Prochaine échéance ${formatWhen(nextEvent.date).toLowerCase()} : ${upcomingEventMeta(nextEvent).title}.`
                  : "Rien d'enregistré non plus pour les jours à venir — planifie une séance, ou note celle que tu viens de faire."}
            </Text>
          </View>
        ) : (
          <View className={CARD}>
            {todayEvents.map((event, i) => {
              const meta = upcomingEventMeta(event);
              const time = eventTime(event);
              const session = event.kind === "session" ? event.session : null;
              return (
                <View
                  key={event.id}
                  className={`flex-row items-center gap-3 py-3.5 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <TouchableOpacity
                    onPress={() => router.push("/(tabs)/planning")}
                    activeOpacity={0.7}
                    className="flex-1 flex-row items-center gap-3"
                  >
                    <View className={`h-9 w-9 items-center justify-center rounded-full ${meta.chip}`}>
                      <MaterialCommunityIcons name={meta.icon} size={18} color={meta.tint} />
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text
                        className={`text-[15px] font-semibold ${session?.completed ? "text-muted line-through" : "text-text"}`}
                      >
                        {meta.title}
                      </Text>
                      <Text className="text-sm text-muted">{time ? `${meta.label} · ${time}` : meta.label}</Text>
                    </View>
                  </TouchableOpacity>
                  {session ? (
                    <TouchableOpacity
                      onPress={() => toggleCompleted(session.id)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={session.completed ? "Marquer à faire" : "Marquer faite"}
                      className={`rounded-full border px-3 py-1.5 ${
                        session.completed ? "border-success bg-success/15" : "border-primary"
                      }`}
                    >
                      <Text className={`text-xs font-bold ${session.completed ? "text-success" : "text-primary"}`}>
                        {session.completed ? "Faite ✓" : "Marquer faite"}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text className={`text-xs font-bold ${meta.tag}`}>{meta.label}</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </FadeInView>

      {/* Planifier une séance — bouton conservé d'un accès direct, y compris
          quand la journée est déjà remplie (cf. audit produit du 2026-09-05 :
          il ne doit jamais se contenter d'une Alert). `ts` unique à chaque
          appui, cf. son commentaire dans handleQuickAdd. */}
      <FadeInView delay={120}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() =>
            router.push({ pathname: "/(tabs)/planning", params: { openForm: "session", ts: String(Date.now()) } })
          }
          className="flex-row items-center justify-center gap-2 rounded-card bg-primary p-4"
        >
          <Text className="text-base font-bold text-on-primary">Planifier une séance</Text>
        </TouchableOpacity>
      </FadeInView>

      {/* Prochainement — les jours suivants seulement (aujourd'hui est
          au-dessus), planning unifié comme avant (cf. plan Phase 3 Étape 3). */}
      {laterEvents.length > 0 ? (
        <>
          <FadeInView delay={140}>
            <View className="mt-1 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-text">Prochainement</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/planning")}>
                <Text className="text-sm font-semibold text-accent">Voir tout</Text>
              </TouchableOpacity>
            </View>
          </FadeInView>
          <FadeInView delay={160}>
            <View className={CARD}>
              {laterEvents.map((event, i) => {
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
          </FadeInView>
        </>
      ) : null}

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
            targetHorseName={horse?.name ?? null}
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
            targetHorseName={horse?.name ?? null}
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
            targetHorseName={horse?.name ?? null}
            onOpen={() => setShowJournalForm(true)}
            onCancel={cancelJournalForm}
            onSubmit={handleSubmitJournalEntry}
            onPickPhoto={handlePickJournalPhoto}
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

      {/* Second plan : météo, bilan de la semaine et conseil du jour. Rien ici
          ne demande d'action ni ne se périme dans la journée — c'est ce qu'on
          lit APRÈS avoir vu ce qu'il y a à faire, alors que la météo et
          l'anneau hebdomadaire occupaient jusqu'ici le haut de l'écran. */}
      <FadeInView delay={280}>
        <WeatherForecastStrip />
      </FadeInView>

      <FadeInView delay={300}>
        <View className={`${CARD} flex-row items-center gap-3`}>
          <CircularProgress
            progress={weekSessions.length > 0 ? weekDoneCount / weekSessions.length : 0}
            size={44}
            strokeWidth={5}
            trackColor={colors.border}
            progressColor={colors.primary}
          >
            <Text className="text-[11px] font-bold text-text">
              {weekDoneCount}/{weekSessions.length}
            </Text>
          </CircularProgress>
          <View className="flex-1 gap-0.5">
            <Text className="text-xs font-bold uppercase tracking-wide text-muted">Cette semaine</Text>
            <Text className="text-[13px] leading-[17px] text-text">
              {weeklyRecapMessage(weekDoneCount, weekSessions.length)}
            </Text>
          </View>
        </View>
      </FadeInView>

      <FadeInView delay={320}>
        <View className="flex-row gap-3 rounded-card bg-highlight p-5">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
            <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color={colors.primary} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-bold uppercase tracking-wide text-primary">Conseil du jour</Text>
            <Text className="text-[15px] leading-5 text-text">{dailyTip()}</Text>
          </View>
        </View>
      </FadeInView>
    </Screen>
    <QuickAddSheet visible={quickAddVisible} onClose={() => setQuickAddVisible(false)} onSelect={handleQuickAdd} />
    <PickerOverlaySlot />
    </>
  );
}
