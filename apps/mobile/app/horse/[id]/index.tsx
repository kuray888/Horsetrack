import { useEffect, useState } from "react";
import { Share, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { useWeight } from "@/horses/weightStore";
import { useGoals } from "@/goals/store";
import { buildHorseShareText } from "@/horses/shareHorseText";
import { useSubscription } from "@/subscription/store";
import { useSessions } from "@/sessions/store";
import { useAgenda, daysFromNow, type Appointment, type ExpenseCategory } from "@/agenda/store";
import { computeSessionStats } from "@/sessions/stats";
import { formatDuration, formatDate } from "@/lib/dateFormat";
import {
  APPT_META,
  daysUntilLabel,
  formatAmount,
  suggestedAppointmentFor as findSuggestedAppointment,
} from "@/agenda/meta";
import { findNextDue, findNextCompetition } from "@/agenda/upcoming";
import { buildActivityEntries } from "@/agenda/activity";
import { ActivityFeed } from "@/agenda/components/ActivityFeed";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { HorseModuleCard } from "@/horses/components/HorseModuleCard";
import { HorseBanner } from "@/horses/components/HorseBanner";
import { QuickAddSheet, type QuickAddOption } from "@/components/QuickAddSheet";
import { useAppointmentForm } from "@/agenda/hooks/useAppointmentForm";
import { AppointmentForm } from "@/agenda/components/AppointmentForm";
import { useExpenseForm } from "@/agenda/hooks/useExpenseForm";
import { ExpenseForm } from "@/agenda/components/ExpenseForm";
import { useJournalForm } from "@/agenda/hooks/useJournalForm";
import { JournalForm } from "@/agenda/components/JournalForm";

const CARD = "rounded-card bg-surface p-5 shadow-card";

/**
 * Fiche cheval — hub principal de HorseTrack (cf. plan Phase 3 Étape 2) : identité,
 * 6 modules (résumés réels, pas de données fictives) et activité récente.
 * Toute création via l'ajout rapide passe par les hooks déjà utilisés dans
 * Agenda/Journal (useAppointmentForm/useExpenseForm/useJournalForm) — aucune
 * nouvelle logique métier. Les modules eux-mêmes (listes complètes,
 * édition) restent dans Agenda/Planning/Journal pour cette tranche (cf.
 * app/horse/[id]/*.tsx, qui pointent vers eux plutôt que de les dupliquer).
 */
export default function HorseHubScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { horses, selectedHorse, selectHorse } = useHorses();
  const { isActiveOrTrialing } = useSubscription();
  const { sessions } = useSessions();
  const { measurements } = useWeight();
  const { goals } = useGoals();
  const {
    appointments,
    documents,
    journal,
    expenses,
    addAppointment,
    updateAppointment,
    addExpense,
    updateExpense,
    addDocument,
    linkExpenseDocument,
    addJournalEntry,
    updateJournalEntry,
  } = useAgenda();

  const horse = horses.find((h) => h.id === id);
  const isOwner = !!horse && !horse.sharedRole;

  // Le cheval consulté ici devient le cheval actif global — même mécanisme
  // partout ailleurs (Chevaux, today.tsx…), pas de deuxième logique de
  // sélection. Nécessaire aussi pour la cohérence : addAppointment/
  // addExpense/addJournalEntry (cf. agenda/store.tsx) rattachent toujours au
  // cheval globalement sélectionné, jamais à un paramètre d'écran.
  useEffect(() => {
    if (horse && selectedHorse?.id !== horse.id) selectHorse(horse.id);
  }, [horse, selectedHorse?.id, selectHorse]);

  // notifPermission n'est utile qu'à scheduleApptReminder (cf.
  // useAppointmentForm) — cet écran n'affiche pas de bannière dessus,
  // contrairement à agenda.tsx, donc seul le setter est nécessaire.
  const [, setNotifPermission] = useState<boolean | null>(null);
  const [quickAddVisible, setQuickAddVisible] = useState(false);

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
    handlePickJournalPhoto,
  } = useJournalForm({ addJournalEntry, updateJournalEntry, onEditStart: () => {} });

  if (!horse) {
    return (
      <Screen>
        <FadeInView>
          <View className={`${CARD} items-center gap-2`}>
            <MaterialCommunityIcons name="horse-variant" size={28} color={colors.textMuted} />
            <Text className="text-sm text-muted">Ce cheval est introuvable.</Text>
          </View>
        </FadeInView>
      </Screen>
    );
  }

  const today = daysFromNow(0);
  const horseAppointments = appointments.filter((a) => a.horseId === horse.id);
  const horseExpenses = expenses.filter((e) => e.horseId === horse.id);
  const horseJournal = journal.filter((j) => j.horseId === horse.id);
  const horseDocuments = documents.filter((d) => d.horseId === horse.id);
  // Un seul objectif mis en avant (cf. audit produit mini-sprint) : le plus
  // proche dans le temps s'il y en a plusieurs pour ce cheval, sinon le
  // premier trouvé — pas de nouveau module, juste une carte optionnelle qui
  // réutilise le modèle Goal existant (cf. goals/store.tsx).
  const horseGoal = goals
    .filter((g) => g.horseId === horse.id)
    .sort((a, b) => (a.targetDate?.getTime() ?? Infinity) - (b.targetDate?.getTime() ?? Infinity))[0] ?? null;
  const horseSessions = sessions.filter((s) => s.horseId === horse.id);

  // Suggestion de rapprochement pour le formulaire de dépense (cf.
  // agenda/meta.ts suggestedAppointmentFor, partagé avec today.tsx/planning.tsx).
  function suggestedAppointmentFor(category: ExpenseCategory): Appointment | null {
    return findSuggestedAppointment(horseAppointments, category);
  }

  // — Modules —
  const nextDue = findNextDue(appointments, horse.id, today);
  const santeValue = nextDue ? `${APPT_META[nextDue.type].label} ${daysUntilLabel(nextDue.nextDueDate!)}` : "Aucune échéance";

  const stats = computeSessionStats(horseSessions, new Date(2000, 0, 1), new Date());
  const entrainementValue =
    stats.sessionCount > 0
      ? `${stats.sessionCount} séance${stats.sessionCount > 1 ? "s" : ""} · ${formatDuration(stats.totalMinutes)}`
      : "Aucune séance faite";

  const nextCompetition = findNextCompetition(appointments, horse.id, today);
  const concoursValue = nextCompetition
    ? `${nextCompetition.title || "Concours"} · ${formatDate(nextCompetition.date)}`
    : "Aucun concours prévu";

  const journalValue = horseJournal.length > 0 ? `${horseJournal.length} souvenir${horseJournal.length > 1 ? "s" : ""}` : "Aucun souvenir";

  const now = new Date();
  const monthTotal = horseExpenses
    .filter((e) => e.date.getFullYear() === now.getFullYear() && e.date.getMonth() === now.getMonth())
    .reduce((sum, e) => sum + e.amount, 0);
  const budgetValue = monthTotal > 0 ? `${formatAmount(monthTotal, "EUR")} ce mois` : "Rien ce mois-ci";

  const documentsValue =
    horseDocuments.length > 0 ? `${horseDocuments.length} document${horseDocuments.length > 1 ? "s" : ""}` : "Aucun document";

  const horseMeasurements = measurements.filter((m) => m.horseId === horse.id).sort((a, b) => b.date.getTime() - a.date.getTime());
  const previousMeasurement = horseMeasurements[1] ?? null;
  const weightTrend = previousMeasurement ? horseMeasurements[0].weightKg - previousMeasurement.weightKg : null;
  const weightValue = horse.weightKg
    ? `${horse.weightKg} kg${weightTrend ? ` · ${weightTrend > 0 ? "+" : ""}${weightTrend} kg` : ""}`
    : "Aucune mesure";

  const activityEntries = buildActivityEntries(horse.id, { sessions, appointments, journal, expenses });

  function handleQuickAdd(option: QuickAddOption) {
    setQuickAddVisible(false);
    switch (option) {
      case "seance":
        // ?openForm=session ouvre directement le formulaire de création dans
        // Planning ; le cheval actif (selectedHorse) est déjà celui de ce Hub
        // (cf. l'effet ci-dessus qui synchronise selectHorse au montage). `ts`
        // rend chaque appui unique (cf. son commentaire dans planning.tsx) :
        // sans lui, rouvrir le formulaire une deuxième fois depuis ce Hub ne
        // faisait rien si Planning était resté monté avec la même valeur
        // "session" depuis la visite précédente.
        router.dismissTo({ pathname: "/(tabs)/planning", params: { openForm: "session", ts: String(Date.now()) } });
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
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
    <Screen>
      <FadeInView>
        <HorseBanner
          horse={horse}
          isOwner={isOwner}
          onEdit={() => router.push(`/edit-horse-modal?id=${horse.id}`)}
        />
      </FadeInView>

      {isOwner ? (
        <FadeInView delay={40}>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => router.push(`/edit-horse-modal?id=${horse.id}`)}
              activeOpacity={0.8}
              className="flex-1 items-center rounded-card border border-border p-3"
            >
              <Text className="text-sm font-semibold text-text">Modifier</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push(`/share-horse-modal?horseId=${horse.id}`)}
              activeOpacity={0.8}
              className="flex-1 items-center rounded-card border border-border p-3"
            >
              <Text className="text-sm font-semibold text-text">Partager</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Share.share({ message: buildHorseShareText(horse) })}
              activeOpacity={0.8}
              className="flex-1 items-center rounded-card border border-border p-3"
            >
              <Text className="text-sm font-semibold text-text">Fiche</Text>
            </TouchableOpacity>
          </View>
        </FadeInView>
      ) : null}

      {horseGoal ? (
        <FadeInView delay={60}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push(`/goal-modal?id=${horseGoal.id}`)}
            className={`${CARD} gap-1`}
          >
            <View className="flex-row items-center gap-1.5">
              <MaterialCommunityIcons name="target" size={16} color={colors.accent} />
              <Text className="text-xs font-bold uppercase tracking-wide text-accent">Objectif</Text>
            </View>
            <Text className="text-base font-bold text-text">{horseGoal.title}</Text>
            <View className="mt-1 flex-row items-center justify-between">
              <Text className="text-sm text-muted">
                {horseGoal.targetDate ? formatDate(horseGoal.targetDate) : "Sans échéance"}
              </Text>
              <Text className="text-sm font-semibold text-accent">Voir l&apos;objectif</Text>
            </View>
          </TouchableOpacity>
        </FadeInView>
      ) : null}

      <FadeInView delay={80}>
        <HorseModuleCard
          icon="heart-pulse"
          iconColor={colors.warning}
          title="Santé"
          value={santeValue}
          onPress={() => router.push(`/horse/${horse.id}/sante`)}
        />
      </FadeInView>
      <FadeInView delay={100}>
        <HorseModuleCard
          icon="chart-line"
          iconColor={colors.primary}
          title="Entraînement"
          value={entrainementValue}
          // Navigation directe vers la destination finale (cf. audit crash du
          // 2026-09-05, round 2) — l'ancien écran intermédiaire
          // horse/[id]/entrainement.tsx (push puis redirect immédiat, même
          // via <Redirect> déclaratif) plantait en TestFlight. Round 3 :
          // router.push ET router.navigate empilent TOUS LES DEUX une
          // nouvelle instance de (tabs) par-dessus celle déjà montée sous le
          // Horse Hub (vérifié empiriquement sur le vrai StackRouter
          // d'expo-router : ni PUSH ni NAVIGATE ne retrouvent une route
          // existante ailleurs que l'écran focus actuel, en l'absence de
          // `getId`/`singular` sur l'écran "(tabs)" du root Stack — seul le
          // point de divergence compte, hors PUSH/NAVIGATE ne cherchent que
          // dans la route focus). Seul router.dismissTo (action POP_TO)
          // retrouve l'instance "(tabs)" existante par nom dans toute la
          // pile et revient dessus au lieu d'en empiler une nouvelle — c'est
          // le seul des trois qui ne duplique jamais le navigateur (cf. aussi
          // journal/agenda plus bas, même correctif). Le cheval actif est
          // déjà synchronisé par l'effet du Horse Hub ci-dessus, donc rien à
          // refaire ici.
          onPress={() => router.dismissTo("/(tabs)/planning?filter=session")}
        />
      </FadeInView>
      <FadeInView delay={120}>
        <HorseModuleCard
          icon="trophy-outline"
          iconColor={colors.accent}
          title="Concours"
          value={concoursValue}
          onPress={() => router.dismissTo("/(tabs)/planning?filter=concours")}
        />
      </FadeInView>
      <FadeInView delay={140}>
        <HorseModuleCard
          icon="notebook-outline"
          iconColor={colors.primary}
          title="Journal"
          value={journalValue}
          onPress={() => router.dismissTo(`/(tabs)/journal?horse=${horse.id}`)}
        />
      </FadeInView>
      <FadeInView delay={160}>
        <HorseModuleCard
          icon="wallet-outline"
          iconColor={colors.success}
          title="Budget"
          value={budgetValue}
          onPress={() => router.dismissTo("/(tabs)/agenda?section=finances")}
        />
      </FadeInView>
      <FadeInView delay={180}>
        <HorseModuleCard
          icon="folder-outline"
          iconColor={colors.primary}
          title="Documents"
          value={documentsValue}
          onPress={() => router.dismissTo("/(tabs)/agenda?section=documents")}
        />
      </FadeInView>
      <FadeInView delay={195}>
        <HorseModuleCard
          icon="scale-bathroom"
          iconColor={colors.accent}
          title="Poids"
          value={weightValue}
          onPress={() => router.push(`/horse/${horse.id}/poids`)}
        />
      </FadeInView>

      {showApptForm ? (
        <FadeInView delay={200}>
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
        </FadeInView>
      ) : null}
      {showExpenseForm ? (
        <FadeInView delay={200}>
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
        </FadeInView>
      ) : null}
      {showJournalForm ? (
        <FadeInView delay={200}>
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
        </FadeInView>
      ) : null}

      <FadeInView delay={220}>
        <View className="mt-1 flex-row items-center justify-between">
          <Text className="text-xl font-bold text-text">Activité récente</Text>
          <TouchableOpacity onPress={() => router.push(`/horse/${horse.id}/historique`)}>
            <Text className="text-sm font-semibold text-accent">Voir tout</Text>
          </TouchableOpacity>
        </View>
      </FadeInView>
      <FadeInView delay={240}>
        <ActivityFeed
          entries={activityEntries}
          limit={6}
          emptyMessage={`Rien à afficher pour l'instant : les séances, soins, entrées de journal et dépenses passées de ${horse.name} apparaîtront ici.`}
        />
      </FadeInView>
      {/* Le bouton "+" flottant (cf. plus bas, hors du ScrollView pour rester
          fixe) est positionné en absolute par-dessus ce contenu — sans cette
          marge, le dernier élément d'Activité récente se retrouve caché
          derrière lui en bas de page (repéré sur une capture TestFlight). */}
      <View className="h-16" />
    </Screen>

    {/* En dehors du ScrollView de Screen : position absolute doit rester
        fixe par rapport à l'écran, pas défiler avec le contenu. */}
    <TouchableOpacity
      onPress={() => setQuickAddVisible(true)}
      activeOpacity={0.85}
      accessibilityLabel="Ajouter"
      accessibilityRole="button"
      className="absolute bottom-6 right-5 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-card"
    >
      <MaterialCommunityIcons name="plus" size={26} color={colors.textOnPrimary} />
    </TouchableOpacity>
    <QuickAddSheet visible={quickAddVisible} onClose={() => setQuickAddVisible(false)} onSelect={handleQuickAdd} />
    <PickerOverlaySlot />
    </SafeAreaView>
  );
}
