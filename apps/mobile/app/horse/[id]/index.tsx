import { useEffect, useState } from "react";
import { Image, Share, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
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
import { QuickAddSheet, type QuickAddOption } from "@/components/QuickAddSheet";
import { useAppointmentForm } from "@/agenda/hooks/useAppointmentForm";
import { AppointmentForm } from "@/agenda/components/AppointmentForm";
import { useExpenseForm } from "@/agenda/hooks/useExpenseForm";
import { ExpenseForm } from "@/agenda/components/ExpenseForm";
import { useJournalForm } from "@/agenda/hooks/useJournalForm";
import { JournalForm } from "@/agenda/components/JournalForm";
import { DISCIPLINES, HORSE_LEVELS } from "@/onboarding/options";

const CARD = "rounded-card bg-surface p-5 shadow-card";

const ROLE_LABEL: Record<"DEMI_PENSION" | "COACH" | "RIDER" | "GROOM", string> = {
  DEMI_PENSION: "Demi-pension",
  COACH: "Coach / enseignant",
  RIDER: "Cavalière / cavalier",
  GROOM: "Groom / palefrenier",
};

function labelOf<T extends string>(options: { value: T; label: string }[], value: T): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

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
  const horseSessions = sessions.filter((s) => s.horseId === horse.id);

  // Suggestion de rapprochement pour le formulaire de dépense (cf.
  // agenda/meta.ts suggestedAppointmentFor, partagé avec today.tsx/planning.tsx).
  function suggestedAppointmentFor(category: ExpenseCategory): Appointment | null {
    return findSuggestedAppointment(horseAppointments, category);
  }

  const age = horse.birthYear ? `${new Date().getFullYear() - horse.birthYear} ans` : null;

  // — Modules —
  const nextDue = findNextDue(appointments, horse.id, today);
  const santeValue = nextDue ? `${APPT_META[nextDue.type].label} ${daysUntilLabel(nextDue.nextDueDate!)}` : "Aucune échéance";

  const stats = computeSessionStats(horseSessions, new Date(2000, 0, 1), new Date());
  const entrainementValue =
    stats.sessionCount > 0 ? `${stats.sessionCount} séances · ${formatDuration(stats.totalMinutes)}` : "Aucune séance faite";

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

  const activityEntries = buildActivityEntries(horse.id, { sessions, appointments, journal, expenses });

  function handleQuickAdd(option: QuickAddOption) {
    setQuickAddVisible(false);
    switch (option) {
      case "seance":
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
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
    <Screen>
      <FadeInView>
        <View className={`${CARD} flex-row items-center gap-4`}>
          <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-highlight">
            {horse.photoUrl ? (
              <Image source={{ uri: horse.photoUrl }} className="h-16 w-16" />
            ) : (
              <MaterialCommunityIcons name="horse-variant" size={30} color={colors.primary} />
            )}
          </View>
          <View className="flex-1 gap-1">
            <View className="flex-row items-center gap-1.5">
              <Text className="text-xl font-display-bold text-text">{horse.name}</Text>
              {horse.isPrimary ? <MaterialCommunityIcons name="star" size={15} color={colors.warning} /> : null}
            </View>
            {horse.sharedRole ? (
              <View className="flex-row items-center gap-1">
                <MaterialCommunityIcons name="handshake-outline" size={13} color={colors.accent} />
                <Text className="text-xs font-semibold text-accent">{ROLE_LABEL[horse.sharedRole]}</Text>
              </View>
            ) : null}
            <Text className="text-sm text-muted">
              {labelOf(DISCIPLINES, horse.discipline)} · {labelOf(HORSE_LEVELS, horse.level)}
            </Text>
            <Text className="text-xs text-muted">
              {[horse.breed, horse.coat, age].filter(Boolean).join(" · ") || "Aucune info supplémentaire"}
            </Text>
          </View>
        </View>
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
          onPress={() => router.push(`/horse/${horse.id}/entrainement`)}
        />
      </FadeInView>
      <FadeInView delay={120}>
        <HorseModuleCard
          icon="trophy-outline"
          iconColor={colors.accent}
          title="Concours"
          value={concoursValue}
          onPress={() => router.push(`/horse/${horse.id}/concours`)}
        />
      </FadeInView>
      <FadeInView delay={140}>
        <HorseModuleCard
          icon="notebook-outline"
          iconColor={colors.primary}
          title="Journal"
          value={journalValue}
          onPress={() => router.push(`/horse/${horse.id}/journal`)}
        />
      </FadeInView>
      <FadeInView delay={160}>
        <HorseModuleCard
          icon="wallet-outline"
          iconColor={colors.success}
          title="Budget"
          value={budgetValue}
          onPress={() => router.push(`/horse/${horse.id}/budget`)}
        />
      </FadeInView>
      <FadeInView delay={180}>
        <HorseModuleCard
          icon="folder-outline"
          iconColor={colors.primary}
          title="Documents"
          value={documentsValue}
          onPress={() => router.push(`/horse/${horse.id}/documents`)}
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
