import { useState } from "react";
import { Share, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { BackButton } from "@/components/BackButton";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { useWeight } from "@/horses/weightStore";
import { useGoals } from "@/goals/store";
import { buildHorseShareText } from "@/horses/shareHorseText";
import { DOWNLOAD_URL } from "@/lib/links";
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
 * Fiche cheval — hub principal de HorseTrack : identité, modules (résumés
 * réels, pas de données fictives) et activité récente. Toute création via
 * l'ajout rapide passe par les hooks déjà utilisés ailleurs
 * (useAppointmentForm/useExpenseForm/useJournalForm) — aucune logique métier
 * propre à cet écran.
 *
 * Composant plutôt qu'écran depuis qu'il s'affiche à DEUX endroits :
 *
 * - empilé au-dessus des onglets, quand on ouvre un cheval depuis la liste
 *   (cf. app/horse/[id]/index.tsx) ;
 * - directement DANS l'onglet « Chevaux » quand l'écurie ne compte qu'un
 *   cheval (cf. app/(tabs)/chevaux.tsx) — une liste d'une seule ligne
 *   n'apprend rien et coûtait un appui de plus vers l'écran le plus utilisé
 *   de l'app.
 *
 * La bascule passe par `inTab` plutôt que par une redirection : un écran
 * intermédiaire qui redirige à son montage, même via `<Redirect>`, plantait
 * en TestFlight (cf. horses/horseHubNavigation.test.ts et l'ancien
 * horse/[id]/entrainement.tsx). On ne refait pas ça.
 */
export function HorseHub({ horseId, inTab = false }: { horseId: string | undefined; inTab?: boolean }) {
  const colors = useThemeColors();
  const id = horseId;
  const { horses, selectHorse, syncFailed, retrySync } = useHorses();
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

  /** Consulter une fiche ne change PLUS le cheval actif global : ouvrir la
   * fiche de B depuis une alerte de l'Accueil recadrait silencieusement
   * Accueil/Planning/Agenda sur B, et il fallait s'en apercevoir en revenant
   * sur l'onglet. Deux conséquences, traitées dans cet écran :
   *
   * 1. Les créations de cette fiche visent `horse` EXPLICITEMENT (cf. les
   *    trois hooks plus bas, qui le reçoivent en paramètre) au lieu de
   *    compter sur le cheval globalement sélectionné.
   * 2. Les cartes qui renvoient vers un onglet cadré sur le cheval actif
   *    (cf. `focusThisHorse`, après le garde `!horse`) le sélectionnent AVANT de
   *    naviguer : le changement de contexte devient le résultat visible d'un
   *    appui, sur un écran qui affiche HorseSwitcher et le nom du cheval —
   *    plus un effet de bord du simple fait d'avoir regardé une fiche. */

  // notifPermission n'est utile qu'à scheduleApptReminder (cf.
  // useAppointmentForm) — cet écran n'affiche pas de bannière dessus,
  // contrairement à l'Accueil, donc seul le setter est nécessaire.
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
  } = useExpenseForm({
    addExpense,
    updateExpense,
    addDocument,
    linkExpenseDocument,
    isActiveOrTrialing,
    // Cette fiche ne change pas le cheval actif (cf. le commentaire en tête
    // de l'écran) : elle doit donc dire elle-même sur quel cheval elle écrit.
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

  if (!horse) {
    return (
      <Screen>
        {inTab ? null : <BackButton />}
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

  /** Rend ce cheval actif — appelé AVANT de partir vers un onglet cadré sur
   * le cheval actif (cf. le commentaire en tête de l'écran), jamais au simple
   * montage. Les `router.dismissTo` restent écrits sur place : seul
   * `dismissTo` retrouve l'instance "(tabs)" déjà montée au lieu d'en empiler
   * une seconde (cf. horseHubNavigation.test.ts), et l'inliner garde le
   * chemin littéral typé par expo-router. */
  const focusThisHorse = () => selectHorse(horse.id);

  /** Va vers un onglet. Empilé au-dessus des onglets, seul `dismissTo`
   * retrouve l'instance « (tabs) » déjà montée au lieu d'en empiler une
   * seconde — c'est ce qui causait un crash natif (cf. le commentaire de la
   * carte Entraînement plus bas, et horseHubNavigation.test.ts). Rendu DANS
   * un onglet, il n'y a rien à dépiler : une navigation normale suffit, et
   * `dismissTo` n'aurait pas de cible. */
  function goToTab(href: Parameters<typeof router.dismissTo>[0]) {
    if (inTab) router.navigate(href);
    else router.dismissTo(href);
  }

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
        // Planning. `focusThisHorse` d'abord (même raison que les cartes de
        // modules) : Planning cadre son formulaire sur le cheval actif, et ce
        // Hub ne le sélectionne plus à l'ouverture. `ts` rend chaque appui
        // unique (cf. son commentaire dans planning.tsx) : sans lui, rouvrir
        // le formulaire une deuxième fois depuis ce Hub ne faisait rien si
        // Planning était resté monté avec la même valeur "session" depuis la
        // visite précédente.
        focusThisHorse();
        goToTab({ pathname: "/(tabs)/planning", params: { openForm: "session", ts: String(Date.now()) } });
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
    <SafeAreaView className="flex-1 bg-background" edges={inTab ? [] : ["bottom"]}>
    <Screen>
      {/* Rien où revenir depuis un onglet : le bouton n'y a pas sa place. */}
      {inTab ? null : <BackButton />}
      {/* Bannière de synchro : elle vivait dans la liste des chevaux, que
          cet onglet n'affiche plus pour une écurie d'un seul cheval — sans
          elle, un échec de synchro redeviendrait invisible (cf. audit du
          2026-09-16). */}
      {inTab && syncFailed ? (
        <FadeInView>
          <View className="flex-row items-center gap-2.5 rounded-card bg-warning/15 p-3.5">
            <MaterialCommunityIcons name="cloud-off-outline" size={18} color={colors.warning} />
            <Text className="flex-1 text-sm text-text">
              Certaines modifications ne sont pas encore synchronisées.
            </Text>
            <TouchableOpacity onPress={() => retrySync()} hitSlop={8}>
              <Text className="text-sm font-bold text-warning">Réessayer</Text>
            </TouchableOpacity>
          </View>
        </FadeInView>
      ) : null}
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
              onPress={() => Share.share({ message: buildHorseShareText(horse, DOWNLOAD_URL) }).catch(() => {})}
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
          // journal/agenda plus bas, même correctif). Planning étant cadré
          // sur le cheval actif, `focusThisHorse` le pose juste avant : cette
          // fiche ne le sélectionne plus à l'ouverture.
          onPress={() => {
            focusThisHorse();
            goToTab("/(tabs)/planning?filter=session");
          }}
        />
      </FadeInView>
      <FadeInView delay={120}>
        <HorseModuleCard
          icon="trophy-outline"
          iconColor={colors.accent}
          title="Concours"
          value={concoursValue}
          onPress={() => {
            focusThisHorse();
            goToTab("/(tabs)/planning?filter=concours");
          }}
        />
      </FadeInView>
      <FadeInView delay={140}>
        <HorseModuleCard
          icon="notebook-outline"
          iconColor={colors.primary}
          title="Journal"
          value={journalValue}
          onPress={() => {
            focusThisHorse();
            goToTab(`/(tabs)/journal?horse=${horse.id}`);
          }}
        />
      </FadeInView>
      <FadeInView delay={160}>
        <HorseModuleCard
          icon="wallet-outline"
          iconColor={colors.success}
          title="Budget"
          value={budgetValue}
          // Sous-écran de CETTE fiche, comme Santé et Poids : plus besoin
          // de passer par l'ancien onglet Agenda, ni de changer le cheval
          // actif pour que la destination affiche le bon cheval.
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
            targetHorseName={horse.name}
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
            targetHorseName={horse.name}
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
            targetHorseName={horse.name}
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
      {/* « Ajouter un cheval » vit normalement dans la liste des chevaux,
          que cet onglet remplace ici : sans ce relais, une écurie d'un seul
          cheval n'aurait plus AUCUN moyen d'en ajouter un deuxième — ni
          d'atteindre le paywall qui va avec. */}
      {inTab ? (
        <FadeInView delay={250}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/add-horse-modal")}
            className="mt-1 flex-row items-center justify-center gap-2 rounded-card border border-dashed border-primary p-4"
          >
            <MaterialCommunityIcons name="plus" size={18} color={colors.primary} />
            <Text className="text-base font-semibold text-primary">Ajouter un cheval</Text>
          </TouchableOpacity>
        </FadeInView>
      ) : null}

      {/* Le bouton "+" flottant (cf. plus bas, hors du ScrollView pour rester
          fixe) est positionné en absolute par-dessus ce contenu — sans cette
          marge, le dernier élément d'Activité récente se retrouve caché
          derrière lui en bas de page (repéré sur une capture TestFlight).
          Dans un onglet, la barre de navigation mange la même hauteur en
          plus, d'où la marge doublée. */}
      <View className={inTab ? "h-32" : "h-16"} />
    </Screen>

    {/* En dehors du ScrollView de Screen : position absolute doit rester
        fixe par rapport à l'écran, pas défiler avec le contenu. */}
    <TouchableOpacity
      onPress={() => setQuickAddVisible(true)}
      activeOpacity={0.85}
      accessibilityLabel="Ajouter"
      accessibilityRole="button"
      className={`absolute right-5 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-card ${
        inTab ? "bottom-20" : "bottom-6"
      }`}
    >
      <MaterialCommunityIcons name="plus" size={26} color={colors.textOnPrimary} />
    </TouchableOpacity>
    <QuickAddSheet visible={quickAddVisible} onClose={() => setQuickAddVisible(false)} onSelect={handleQuickAdd} />
    <PickerOverlaySlot />
    </SafeAreaView>
  );
}
