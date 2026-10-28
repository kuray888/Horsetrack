import { useEffect, useMemo, useState } from "react";
import { RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { RideInProgressBanner } from "@/rides/components/RideInProgressBanner";
import {
  getNotificationPermissionState,
  scheduleWeeklySummary,
  type NotificationPermissionState,
} from "@/lib/notifications";
import { FadeInView } from "@/components/FadeInView";
import { WeatherForecastStrip } from "@/components/WeatherForecastStrip";
import { useWeather } from "@/weather/store";
import { sessionWeatherWarning } from "@/weather/sessionWeather";
import { Screen } from "@/components/Screen";
import { useRiderProfile } from "@/rider/store";
import { useScrollToOnOpen } from "@/components/useScrollToOnOpen";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { useSessions } from "@/sessions/store";
import { SessionDonePrompt, useSessionDonePrompt } from "@/sessions/useSessionDonePrompt";
import { useAgenda, type Appointment, type ExpenseCategory } from "@/agenda/store";
import { suggestedAppointmentFor as findSuggestedAppointment } from "@/agenda/meta";
import { useSubscription } from "@/subscription/store";
import { HorseSwitcher } from "@/horses/components/HorseSwitcher";
import { usePendingSyncCount, useRejectedWriteCount } from "@/lib/useSyncQueue";
import { QuickAddSheet, type QuickAddOption } from "@/components/QuickAddSheet";
import { RemindersUpsellCard } from "@/subscription/RemindersUpsellCard";
import { FirstStepsCard, MonthlyRecapCard } from "@/components/EngagementCards";
import { useCloudRefresh } from "@/lib/cloudRefresh";
import { useAppointmentForm } from "@/agenda/hooks/useAppointmentForm";
import { AppointmentForm } from "@/agenda/components/AppointmentForm";
import { useExpenseForm } from "@/agenda/hooks/useExpenseForm";
import { ExpenseForm } from "@/agenda/components/ExpenseForm";
import { useJournalForm } from "@/agenda/hooks/useJournalForm";
import { JournalForm } from "@/agenda/components/JournalForm";
import { lazyTab } from "@/components/LazyTab";
import { WinbackCard } from "@/subscription/WinbackCard";
import { t } from "@/i18n";
import { featuredReviewYear } from "@/review/yearReview";
import { useHorseDetails } from "@/extras/store";
import { isPartnerDay } from "@/extras/model";
import { useTodayOverview } from "@/today/useTodayOverview";
import { CoachCard } from "@/coach/components/CoachCard";
import { TodayHeader } from "@/today/components/TodayHeader";
import { SyncStatusBanners } from "@/today/components/SyncStatusBanners";
import { TodaySection } from "@/today/components/TodaySection";
import {
  AlertsCard,
  DailyTipCard,
  NotificationPrompt,
  UpcomingCard,
  WeatherWarningBanner,
  WeekRecapCard,
  YearReviewBanner,
} from "@/today/components/TodayCards";

/**
 * Accueil. Découpé en octobre 2026 sans changement de comportement : calculs
 * dans today/useTodayOverview.ts, textes dans today/todayFormat.ts (testés),
 * blocs dans today/components/. Cet écran garde l'ordre des blocs, l'état
 * des notifications et les formulaires d'ajout rapide.
 */

function TodayScreen() {
  const colors = useThemeColors();
  const { horses, selectedHorse } = useHorses();
  const { sessions } = useSessions();
  // Cocher une séance propose d'en dire un mot (cf. useSessionDonePrompt) —
  // le journal se remplit là où la séance se termine, au lieu d'attendre
  // qu'on pense à ouvrir un autre onglet.
  const { toggleSessionDone, prompted, dismissPrompt } = useSessionDonePrompt();
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
  const { riderProfile } = useRiderProfile();
  // Écritures cloud en attente d'un retour du réseau (cf. lib/syncQueue.ts).
  const pendingSync = usePendingSyncCount();
  const rejectedSync = useRejectedWriteCount();
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
  // Distingue « jamais demandé » (on peut encore afficher la demande système,
  // avec sa raison) de « refusé » (seuls les réglages du téléphone y peuvent
  // quelque chose) — cf. la carte plus bas.
  const [notifState, setNotifState] = useState<NotificationPermissionState | null>(null);
  useEffect(() => {
    getNotificationPermissionState()
      .then((state) => {
        setNotifState(state);
        setNotifPermission(state === "granted");
      })
      .catch(() => setNotifPermission(null));
  }, []);
  // Un rappel créé peut avoir déclenché (et essuyé) la demande système :
  // relire l'état pour que la carte propose directement les réglages plutôt
  // qu'un bouton « Activer » devenu sans effet.
  useEffect(() => {
    if (notifPermission !== false) return;
    getNotificationPermissionState()
      .then(setNotifState)
      .catch(() => {});
  }, [notifPermission]);
  const horse = selectedHorse;

  // Une seule fois par montage, pas à chaque render (cf. audit perf du
  // 2026-09-09) : "aujourd'hui" ne change de toute façon pas au sein d'une
  // même session d'app, un `new Date()` frais à chaque render ne ferait que
  // casser toute mémoïsation en aval sans rien apporter.
  const today = useMemo(() => new Date(), []);

  // Tirer pour rafraîchir : relit le serveur (rendez-vous ajoutés par la
  // demi-pension, modifications faites sur un autre appareil).
  const { refresh: refreshFromCloud } = useCloudRefresh();
  const [pullRefreshing, setPullRefreshing] = useState(false);
  async function onPullRefresh() {
    setPullRefreshing(true);
    await refreshFromCloud();
    setPullRefreshing(false);
  }
  const {
    horseSessions,
    horseAppointments,
    weekSessions,
    weekDoneCount,
    streak,
    hasHealthAppointment,
    todayEvents,
    laterEvents,
    nextEvent,
    alerts,
  } = useTodayOverview({ horse: horse ?? null, horses, sessions, appointments, today });
  const reviewYear = featuredReviewYear(today);
  // Jour de la demi-pension (cf. horse/[id]/demi-pension.tsx).
  const partnership = useHorseDetails(horse?.id)?.partnership ?? null;
  const partnerToday = partnership && isPartnerDay(partnership, today) ? partnership.riderName.trim() : null;

  // Météo de la prochaine séance : les prévisions étaient déjà là (bandeau
  // plus bas) et les séances aussi, mais il fallait faire le rapprochement
  // soi-même. Toutes les séances du cheval affiché, pas seulement celles du
  // jour — l'intérêt est justement d'anticiper (cf. weather/sessionWeather.ts).
  const { forecast } = useWeather();
  const weatherWarning = useMemo(
    () => sessionWeatherWarning(horseSessions, forecast, today),
    [horseSessions, forecast, today]
  );

  // Programme (ou met à jour) le bilan du dimanche soir — seulement si les
  // notifications sont déjà autorisées, d'où `notifPermission` dans les
  // dépendances : le bilan se programme dès l'autorisation donnée.
  useEffect(() => {
    if (!horse || !notifPermission) return;
    scheduleWeeklySummary(horse.name, weekDoneCount, weekSessions.length);
  }, [horse?.id, horse?.name, weekDoneCount, weekSessions.length, notifPermission]);

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
    reminderUnlocked,
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

  // Formulaires d'ajout en bas de l'écran : ouverts depuis plus haut (carte
  // Premiers pas), ils restaient hors de vue — cf. useScrollToOnOpen.
  const { scrollRef, onAnchorLayout: onAddFormLayout } = useScrollToOnOpen(
    showApptForm || showExpenseForm || showJournalForm
  );

  function handleQuickAdd(option: QuickAddOption) {
    setQuickAddVisible(false);
    switch (option) {
      case "direct":
        // Écran modal (pas un onglet) : il se pousse par-dessus l'onglet courant.
        router.push("/ride");
        return;
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
    <Screen
      scrollRef={scrollRef}
      refreshControl={<RefreshControl refreshing={pullRefreshing} onRefresh={onPullRefresh} tintColor={colors.primary} />}
    >
      <FadeInView>
        <TodayHeader horse={horse ?? null} />
      </FadeInView>

      {/* Sélecteur de cheval — visible seulement à partir de 2 chevaux dans
          l'écurie (cf. HorseSwitcher, même composant sur Planning/Agenda). */}
      {horses.length > 1 ? (
        <FadeInView delay={40}>
          <HorseSwitcher />
        </FadeInView>
      ) : null}

      <SyncStatusBanners
        saveFailed={saveFailed}
        pendingSync={pendingSync}
        rejectedSync={rejectedSync}
        onRetryRejected={() => void refreshFromCloud()}
      />

      <FadeInView delay={52}>
        <SessionDonePrompt session={prompted} onDismiss={dismissPrompt} />
      </FadeInView>

      <RideInProgressBanner />

      {horse && reviewYear !== null ? <YearReviewBanner horse={horse} year={reviewYear} /> : null}

      <TodaySection
        todayEvents={todayEvents}
        alerts={alerts}
        nextEvent={nextEvent}
        partnerToday={partnerToday}
        onToggleDone={toggleSessionDone}
      />

      {/* Ton coach : la prochaine séance, sous « Aujourd'hui » (cf. coach/). */}
      {horse ? <CoachCard horse={horse} /> : null}

      {/* Météo et conseil du jour, remontés en tête à la demande de
          l'utilisateur (2026-09-23). Ils restent SOUS les bannières de
          sauvegarde : celles-ci signalent une perte de données possible, et
          rien ne doit passer devant. Le bilan hebdomadaire, lui, reste en bas. */}
      <FadeInView delay={53}>
        <WeatherForecastStrip />
      </FadeInView>

      <DailyTipCard discipline={riderProfile.mainDiscipline} />

      {/* Offre de retour — comptes redevenus gratuits uniquement, quand le
          serveur en propose une (cf. subscription/WinbackCard.tsx). */}
      <WinbackCard />

      {weatherWarning ? <WeatherWarningBanner warning={weatherWarning} /> : null}

      {notifPermission === false ? (
        <NotificationPrompt
          state={notifState}
          horseName={horse?.name ?? null}
          onAnswer={(granted) => {
            setNotifPermission(granted);
            setNotifState(granted ? "granted" : "denied");
          }}
        />
      ) : null}

      {alerts.length > 0 ? <AlertsCard alerts={alerts} /> : null}

      {/* Premiers pas, bilan du mois, offre rappels — APRÈS « À surveiller » :
          une alerte santé passe avant tout message d'engagement. Chacun se
          masque seul une fois sans objet, ou à la demande. Premiers pas :
          propriétaire seulement (un cheval partagé n'est pas à configurer). */}
      {horse && !horse.sharedRole ? (
        <FirstStepsCard
          horseName={horse.name}
          hasPhoto={!!horse.photoUrl}
          hasSession={horseSessions.length > 0}
          hasHealthAppointment={hasHealthAppointment}
          onAddPhoto={() => router.push(`/edit-horse-modal?id=${horse.id}`)}
          onPlanSession={() => handleQuickAdd("seance")}
          onAddHealthAppointment={() => handleQuickAdd("soin")}
        />
      ) : null}
      {horse ? (
        <MonthlyRecapCard horseId={horse.id} horseName={horse.name} sessions={sessions} appointments={appointments} />
      ) : null}

      <RemindersUpsellCard />

      {laterEvents.length > 0 ? <UpcomingCard events={laterEvents} /> : null}

      {/* Ajout rapide (cf. plan Phase 3 Étape 4 §9) — le déclencheur cède la
          place au formulaire ouvert, même principe que Planning/Horse Hub
          (jamais les deux affichés en même temps). */}
      <View onLayout={onAddFormLayout}>
      <FadeInView delay={260}>
        {showApptForm ? (
          <AppointmentForm
            show={showApptForm}
            form={apptForm}
            setForm={setApptForm}
            editingApptId={editingApptId}
            reminderUnlocked={reminderUnlocked}
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
          <TouchableOpacity accessibilityRole="button"
            onPress={() => setQuickAddVisible(true)}
            activeOpacity={0.85}
            className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-primary p-4"
          >
            <MaterialCommunityIcons name="plus" size={18} color={colors.primary} />
            <Text className="text-base font-semibold text-primary">{t("Ajouter")}</Text>
          </TouchableOpacity>
        )}
      </FadeInView>
      </View>

      <WeekRecapCard done={weekDoneCount} total={weekSessions.length} streak={streak} horseName={horse?.name ?? null} />

    </Screen>
    <QuickAddSheet visible={quickAddVisible} onClose={() => setQuickAddVisible(false)} onSelect={handleQuickAdd} />
    <PickerOverlaySlot />
    </>
  );
}

export default lazyTab(TodayScreen);
