import { useEffect, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { colors } from "@/theme/colors";
import { FadeInView } from "@/components/FadeInView";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { ensureNotificationPermission } from "@/lib/notifications";
import { useHorses } from "@/horses/store";
import { useSubscription } from "@/subscription/store";
import { Locked } from "@/components/Locked";
import {
  useAgenda,
  daysFromNow,
  type Appointment,
  type Doc,
  type JournalEntry,
  type Expense,
  type ExpenseCategory,
} from "@/agenda/store";
import { APPT_META, EXPENSE_META, expenseCategoryToAppointmentType, formatAmount, capitalize, daysUntilLabel } from "@/agenda/meta";
import { AppointmentForm } from "@/agenda/components/AppointmentForm";
import { AppointmentCard } from "@/agenda/components/AppointmentCard";
import { DocumentForm } from "@/agenda/components/DocumentForm";
import { DocumentCard } from "@/agenda/components/DocumentCard";
import { JournalForm } from "@/agenda/components/JournalForm";
import { JournalCard } from "@/agenda/components/JournalCard";
import { ExpenseForm } from "@/agenda/components/ExpenseForm";
import { ExpenseCard } from "@/agenda/components/ExpenseCard";
import { SectionSwitcher, AGENDA_SECTIONS, type AgendaSection } from "@/agenda/components/SectionSwitcher";
import { useAppointmentForm } from "@/agenda/hooks/useAppointmentForm";
import { useDocumentForm } from "@/agenda/hooks/useDocumentForm";
import { useJournalForm } from "@/agenda/hooks/useJournalForm";
import { useExpenseForm } from "@/agenda/hooks/useExpenseForm";

const CARD = "rounded-card bg-surface p-5 shadow-card";

export default function AgendaScreen() {
  const { selectedHorse: horse } = useHorses();
  const { isActiveOrTrialing } = useSubscription();
  const {
    appointments,
    documents,
    journal,
    expenses,
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
    addDocument,
    updateDocument,
    deleteDocument,
    addJournalEntry,
    updateJournalEntry,
    deleteJournalEntry,
    addExpense,
    updateExpense,
    deleteExpense,
    toggleExpensePaid,
    linkExpenseDocument,
  } = useAgenda();
  // Section initiale optionnelle (cf. app/horse/[id]/sante.tsx et voisins,
  // qui renvoient ici avec ?section=... pour ouvrir directement le bon
  // onglet) — ignorée si absente ou invalide, comportement par défaut
  // inchangé pour toute navigation qui n'en passe pas (ex: today.tsx "Voir tout").
  const { section: sectionParam } = useLocalSearchParams<{ section?: string }>();
  const initialSection = AGENDA_SECTIONS.includes(sectionParam as AgendaSection)
    ? (sectionParam as AgendaSection)
    : "appointments";
  const [section, setSection] = useState<AgendaSection>(initialSection);
  // L'onglet Agenda reste monté entre deux visites (comportement par défaut
  // des Tabs Expo Router) : sans cet ajustement, une deuxième navigation ici
  // avec un ?section= différent (ex: Horse Hub > Budget après Horse Hub >
  // Santé) ne changerait rien, `useState(initialSection)` ne s'exécutant
  // qu'au premier montage. Pattern "ajuster l'état pendant le rendu" plutôt
  // qu'un useEffect (cf. react.dev/learn/you-might-not-need-an-effect) : pas
  // de rendu supplémentaire, et ça évite un set-state-in-effect. Ne touche
  // rien si le paramètre est absent/invalide (ex: appui direct sur l'onglet),
  // pour ne pas écraser le choix de l'utilisateur dans le SectionSwitcher.
  const [syncedSectionParam, setSyncedSectionParam] = useState(sectionParam);
  if (sectionParam !== syncedSectionParam) {
    setSyncedSectionParam(sectionParam);
    if (AGENDA_SECTIONS.includes(sectionParam as AgendaSection)) {
      setSection(sectionParam as AgendaSection);
    }
  }
  const [notifPermission, setNotifPermission] = useState<boolean | null>(null);

  useEffect(() => {
    ensureNotificationPermission().then(setNotifPermission);
  }, []);

  const [expandedApptId, setExpandedApptId] = useState<string | null>(null);
  const [showPastAppts, setShowPastAppts] = useState(false);
  const {
    showApptForm,
    setShowApptForm,
    apptForm,
    setApptForm,
    submittingAppt,
    editingApptId,
    startEditAppt,
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
    onEditStart: () => setExpandedApptId(null),
  });

  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const {
    showDocForm,
    setShowDocForm,
    docForm,
    setDocForm,
    editingDocId,
    startEditDoc,
    cancelDocForm,
    handleSubmitDocument,
    handlePickDocPhoto,
  } = useDocumentForm({
    addDocument,
    updateDocument,
    onEditStart: () => setExpandedDocId(null),
  });

  const [expandedJournalId, setExpandedJournalId] = useState<string | null>(null);
  const {
    showJournalForm,
    setShowJournalForm,
    journalForm,
    setJournalForm,
    savingJournal,
    editingJournalId,
    startEditJournal,
    cancelJournalForm,
    handleSubmitJournalEntry,
    handlePickJournalPhoto,
  } = useJournalForm({
    addJournalEntry,
    updateJournalEntry,
    onEditStart: () => setExpandedJournalId(null),
  });

  const {
    showExpenseForm,
    setShowExpenseForm,
    expenseForm,
    setExpenseForm,
    editingExpenseId,
    startEditExpense,
    cancelExpenseForm,
    handleSubmitExpense,
    handlePickExpensePhoto,
    handleAttachReceipt,
  } = useExpenseForm({
    addExpense,
    updateExpense,
    addDocument,
    linkExpenseDocument,
    isActiveOrTrialing,
  });

  const today = daysFromNow(0);

  // Rendez-vous, journal et documents sont rattachés à un cheval (cf.
  // agenda/store.tsx) — le partage DP/coach se fait par cheval, donc cet
  // écran ne montre que ceux du cheval actuellement sélectionné. Le coffre-
  // fort (documents) reste privé par cavalier côté RLS (jamais partagé, cf.
  // rls.sql) : horseId n'y sert qu'à filtrer l'affichage, pas l'accès.
  const horseAppointments = appointments.filter((a) => a.horseId === horse?.id);
  const horseJournal = journal.filter((j) => j.horseId === horse?.id);
  const horseExpenses = expenses.filter((e) => e.horseId === horse?.id);

  const upcomingAppts = horseAppointments.filter((a) => a.date >= today).sort((a, b) => a.date.getTime() - b.date.getTime());
  // Historique complet pour tout le monde, gratuit comme Premium — pas de
  // plafond du type "14 jours en gratuit" (cf. rls.sql appointments_shared,
  // non gaté par abonnement).
  const pastAppts = horseAppointments.filter((a) => a.date < today).sort((a, b) => b.date.getTime() - a.date.getTime());
  // Prochaines échéances de soin (ex: prochain vaccin) — distinctes de la
  // date du rendez-vous lui-même (cf. Appointment.nextDueDate) : un vaccin
  // fait aujourd'hui a une échéance dans plusieurs mois, qui n'apparaîtrait
  // sinon dans aucune liste triée par `date`.
  const upcomingDueDates = horseAppointments
    .filter((a) => a.nextDueDate && a.nextDueDate >= today)
    .sort((a, b) => a.nextDueDate!.getTime() - b.nextDueDate!.getTime());

  // Filtrés par cheval sélectionné depuis leur rattachement (cf.
  // Doc.horseId) — avant, tous les documents de tous les chevaux
  // s'affichaient mélangés (cf. audit produit du 2026-09-04).
  const sortedDocs = documents
    .filter((d) => d.horseId === horse?.id)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const sortedJournal = [...horseJournal].sort((a, b) => b.date.getTime() - a.date.getTime());

  const sortedExpenses = [...horseExpenses].sort((a, b) => b.date.getTime() - a.date.getTime());
  // Toutes les dépenses sont en EUR pour l'instant (cf. Expense.currency) —
  // un total multi-devises n'aurait pas de sens sans conversion, hors scope.
  const totalExpenses = sortedExpenses.reduce((sum, e) => sum + e.amount, 0);
  // Statut payé/à régler Premium (cf. Expense.isPaid) — en gratuit, tout
  // reste "à régler" faute de pouvoir basculer le statut, cf. handleSubmitExpense.
  const paidExpenses = sortedExpenses.filter((e) => e.isPaid).reduce((sum, e) => sum + e.amount, 0);
  const pendingExpenses = totalExpenses - paidExpenses;

  // "Combien me coûte réellement mon cheval ?" (cf. brief budget) : totaux
  // période courante + répartition par catégorie + historique mensuel, tous
  // calculés à partir de sortedExpenses (déjà filtré par cheval sélectionné)
  // — aucun état ni requête supplémentaire.
  const now2 = new Date();
  const monthTotal = sortedExpenses
    .filter((e) => e.date.getFullYear() === now2.getFullYear() && e.date.getMonth() === now2.getMonth())
    .reduce((sum, e) => sum + e.amount, 0);
  const yearTotal = sortedExpenses
    .filter((e) => e.date.getFullYear() === now2.getFullYear())
    .reduce((sum, e) => sum + e.amount, 0);
  const categoryBreakdown = (Object.keys(EXPENSE_META) as ExpenseCategory[])
    .map((category) => ({
      category,
      total: sortedExpenses.filter((e) => e.category === category).reduce((sum, e) => sum + e.amount, 0),
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
  // 6 derniers mois (mois courant inclus), le plus récent en premier — pas de
  // graphique, juste une liste lisible (cf. principe "présentation simple").
  const monthlyHistory = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now2.getFullYear(), now2.getMonth() - i, 1);
    const total = sortedExpenses
      .filter((e) => e.date.getFullYear() === d.getFullYear() && e.date.getMonth() === d.getMonth())
      .reduce((sum, e) => sum + e.amount, 0);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: capitalize(d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })), total };
  });

  // Suggestion de rapprochement (cf. plan Phase 3) : le rendez-vous le plus
  // récent du même type pour ce cheval, jamais lié automatiquement — juste
  // proposé, l'utilisateur choisit de le lier ou non.
  function suggestedAppointmentFor(category: ExpenseCategory): Appointment | null {
    const apptType = expenseCategoryToAppointmentType(category);
    if (!apptType) return null;
    const candidates = horseAppointments
      .filter((a) => a.type === apptType)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    return candidates[0] ?? null;
  }

  function confirmDeleteAppointment(appt: Appointment) {
    Alert.alert("Supprimer ce rendez-vous ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => deleteAppointment(appt) },
    ]);
  }

  function confirmDeleteDocument(doc: Doc) {
    Alert.alert(
      `Supprimer « ${doc.name} » ?`,
      "Ce document sera définitivement supprimé et ne pourra pas être récupéré.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: () => deleteDocument(doc.id) },
      ]
    );
  }

  function confirmDeleteJournalEntry(entry: JournalEntry) {
    Alert.alert("Supprimer cette entrée ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => deleteJournalEntry(entry.id) },
    ]);
  }

  function confirmDeleteExpense(expense: Expense) {
    Alert.alert("Supprimer cette dépense ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => deleteExpense(expense.id) },
    ]);
  }

  return (
    <>
    <Screen>
      <FadeInView>
        <View className="gap-1">
          <Text className="text-3xl font-display tracking-tight text-text">Agenda</Text>
          <Text className="text-base text-muted">Rendez-vous et documents de {horse?.name ?? "ton cheval"}</Text>
        </View>
      </FadeInView>

      <FadeInView delay={80}>
        <SectionSwitcher section={section} onChange={setSection} />
      </FadeInView>

      {notifPermission === false ? (
        <FadeInView delay={120}>
          <View className={`${CARD} flex-row items-center gap-3`}>
            <MaterialCommunityIcons name="bell-off-outline" size={20} color={colors.textMuted} />
            <Text className="flex-1 text-sm text-muted">
              Notifications désactivées : tes rappels seront enregistrés mais ne s&apos;afficheront pas sur ton téléphone.
            </Text>
            <TouchableOpacity
              onPress={() => ensureNotificationPermission().then(setNotifPermission)}
              activeOpacity={0.7}
            >
              <Text className="text-sm font-bold text-accent">Activer</Text>
            </TouchableOpacity>
          </View>
        </FadeInView>
      ) : null}

      {section === "appointments" ? (
        <>
          <FadeInView delay={140}>
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

          {upcomingDueDates.length > 0 ? (
            <FadeInView delay={180}>
              <View className={`${CARD} gap-2`}>
                <Text className="text-xs font-bold uppercase tracking-wide text-accent">Échéances à venir</Text>
                {upcomingDueDates.map((a) => (
                  <View key={a.id} className="flex-row items-center gap-2.5">
                    <MaterialCommunityIcons name="calendar-clock-outline" size={16} color={colors.accent} />
                    <Text className="flex-1 text-sm text-text">{APPT_META[a.type].label}</Text>
                    <Text className="text-sm font-semibold text-accent">{daysUntilLabel(a.nextDueDate!)}</Text>
                  </View>
                ))}
              </View>
            </FadeInView>
          ) : null}

          <FadeInView delay={200}>
            <Text className="text-xl font-bold text-text">À venir</Text>
          </FadeInView>

          {upcomingAppts.length === 0 ? (
            <FadeInView delay={240}>
              <View className={`${CARD} items-center gap-2`}>
                <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
                  <MaterialCommunityIcons name="calendar-blank-outline" size={22} color={colors.textMuted} />
                </View>
                <Text className="text-sm text-muted">Aucun rendez-vous à venir.</Text>
              </View>
            </FadeInView>
          ) : (
            upcomingAppts.map((appt, i) => (
              <FadeInView key={appt.id} delay={240 + i * 60}>
                <AppointmentCard
                  appt={appt}
                  expanded={expandedApptId === appt.id}
                  onToggleExpand={() => setExpandedApptId(expandedApptId === appt.id ? null : appt.id)}
                  onDelete={() => confirmDeleteAppointment(appt)}
                  onEdit={() => startEditAppt(appt)}
                  onSaveResult={(result) => saveResult(appt.id, result)}
                  onToggleChecklistItem={(itemId) => toggleChecklistItem(appt.id, itemId)}
                  onAddChecklistItem={(label) => addChecklistItem(appt.id, label)}
                  onRemoveChecklistItem={(itemId) => removeChecklistItem(appt.id, itemId)}
                  onAddCompetitionEntry={(entry) => addCompetitionEntry(appt.id, entry)}
                  onUpdateCompetitionEntryResult={(entryId, result) => updateCompetitionEntryResult(appt.id, entryId, result)}
                  onDeleteCompetitionEntry={(entryId) => deleteCompetitionEntry(appt.id, entryId)}
                />
              </FadeInView>
            ))
          )}

          {pastAppts.length > 0 ? (
            <FadeInView delay={300}>
              <TouchableOpacity onPress={() => setShowPastAppts((v) => !v)} activeOpacity={0.7}>
                <Text className="text-sm font-semibold text-accent">
                  {showPastAppts ? "Masquer" : "Voir"} les rendez-vous passés ({pastAppts.length})
                </Text>
              </TouchableOpacity>
            </FadeInView>
          ) : null}

          {showPastAppts &&
            pastAppts.map((appt, i) => (
              <FadeInView key={appt.id} delay={i * 60}>
                <View className="opacity-60">
                  <AppointmentCard
                    appt={appt}
                    expanded={expandedApptId === appt.id}
                    onToggleExpand={() => setExpandedApptId(expandedApptId === appt.id ? null : appt.id)}
                    onDelete={() => confirmDeleteAppointment(appt)}
                    onEdit={() => startEditAppt(appt)}
                    onSaveResult={(result) => saveResult(appt.id, result)}
                    onToggleChecklistItem={(itemId) => toggleChecklistItem(appt.id, itemId)}
                    onAddChecklistItem={(label) => addChecklistItem(appt.id, label)}
                    onRemoveChecklistItem={(itemId) => removeChecklistItem(appt.id, itemId)}
                    onAddCompetitionEntry={(entry) => addCompetitionEntry(appt.id, entry)}
                    onUpdateCompetitionEntryResult={(entryId, result) => updateCompetitionEntryResult(appt.id, entryId, result)}
                    onDeleteCompetitionEntry={(entryId) => deleteCompetitionEntry(appt.id, entryId)}
                  />
                </View>
              </FadeInView>
            ))}
        </>
      ) : section === "documents" ? (
        <>
          <FadeInView delay={140}>
            <DocumentForm
              show={showDocForm}
              form={docForm}
              setForm={setDocForm}
              editingDocId={editingDocId}
              onOpen={() => setShowDocForm(true)}
              onCancel={cancelDocForm}
              onSubmit={handleSubmitDocument}
              onPickPhoto={handlePickDocPhoto}
            />
          </FadeInView>

          {sortedDocs.length === 0 ? (
            <FadeInView delay={200}>
              <View className={`${CARD} items-center gap-2`}>
                <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
                  <MaterialCommunityIcons name="folder-outline" size={22} color={colors.textMuted} />
                </View>
                <Text className="text-sm text-muted">Aucun document pour l&apos;instant.</Text>
              </View>
            </FadeInView>
          ) : (
            sortedDocs.map((doc, i) => (
              <FadeInView key={doc.id} delay={200 + i * 60}>
                <DocumentCard
                  doc={doc}
                  expanded={expandedDocId === doc.id}
                  onToggleExpand={() => setExpandedDocId(expandedDocId === doc.id ? null : doc.id)}
                  onDelete={() => confirmDeleteDocument(doc)}
                  onEdit={() => startEditDoc(doc)}
                />
              </FadeInView>
            ))
          )}
        </>
      ) : section === "journal" ? (
        <>
          <FadeInView delay={100}>
            <Text className="text-sm text-muted">
              Note ici tes séances libres (balade, longe, repos…), en dehors du programme structuré : ton ressenti,
              tes notes, et la météo du jour ajoutée automatiquement (si la localisation est autorisée) — elle
              s&apos;affichera sur l&apos;entrée une fois enregistrée.
            </Text>
          </FadeInView>

          <FadeInView delay={140}>
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

          {sortedJournal.length === 0 ? (
            <FadeInView delay={200}>
              <View className={`${CARD} items-center gap-2`}>
                <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
                  <MaterialCommunityIcons name="notebook-outline" size={22} color={colors.textMuted} />
                </View>
                <Text className="text-sm text-muted">Aucune entrée de journal pour l&apos;instant.</Text>
              </View>
            </FadeInView>
          ) : (
            sortedJournal.map((entry, i) => (
              <FadeInView key={entry.id} delay={200 + i * 60}>
                <JournalCard
                  entry={entry}
                  expanded={expandedJournalId === entry.id}
                  onToggleExpand={() => setExpandedJournalId(expandedJournalId === entry.id ? null : entry.id)}
                  onDelete={() => confirmDeleteJournalEntry(entry)}
                  onEdit={() => startEditJournal(entry)}
                />
              </FadeInView>
            ))
          )}
        </>
      ) : (
        <>
          {sortedExpenses.length > 0 ? (
            <>
              <FadeInView delay={100}>
                <Locked message="Détail payé/à régler réservé à l'abonnement Premium">
                  <View className={`${CARD} flex-row items-center justify-between`}>
                    <View className="items-center gap-0.5">
                      <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Total</Text>
                      <Text className="text-lg font-display text-text">{formatAmount(totalExpenses, "EUR")}</Text>
                    </View>
                    <View className="items-center gap-0.5">
                      <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Payé</Text>
                      <Text className="text-lg font-display text-success">{formatAmount(paidExpenses, "EUR")}</Text>
                    </View>
                    <View className="items-center gap-0.5">
                      <Text className="text-xs font-semibold uppercase tracking-wide text-muted">À payer</Text>
                      <Text className="text-lg font-display text-danger">{formatAmount(pendingExpenses, "EUR")}</Text>
                    </View>
                  </View>
                </Locked>
              </FadeInView>

              <FadeInView delay={120}>
                <Locked message="Répartition du budget réservée à l'abonnement Premium">
                  <View className={`${CARD} gap-4`}>
                    <View className="flex-row items-center justify-between">
                      <View className="gap-0.5">
                        <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Ce mois-ci</Text>
                        <Text className="text-lg font-display text-text">{formatAmount(monthTotal, "EUR")}</Text>
                      </View>
                      <View className="items-end gap-0.5">
                        <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Cette année</Text>
                        <Text className="text-lg font-display text-text">{formatAmount(yearTotal, "EUR")}</Text>
                      </View>
                    </View>

                    {categoryBreakdown.length > 0 ? (
                      <View className="gap-2 border-t border-border pt-3">
                        <Text className="text-xs font-bold uppercase tracking-wide text-accent">Par catégorie</Text>
                        {categoryBreakdown.map(({ category, total }) => {
                          const meta = EXPENSE_META[category];
                          const pct = totalExpenses > 0 ? Math.round((total / totalExpenses) * 100) : 0;
                          return (
                            <View key={category} className="flex-row items-center gap-2.5">
                              <View className={`h-8 w-8 items-center justify-center rounded-full ${meta.chip}`}>
                                <MaterialCommunityIcons name={meta.icon.name} size={15} color={meta.icon.color} />
                              </View>
                              <Text className="flex-1 text-sm text-text">{meta.label}</Text>
                              <Text className="text-xs text-muted">{pct}%</Text>
                              <Text className="w-20 text-right text-sm font-bold text-text">
                                {formatAmount(total, "EUR")}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    ) : null}

                    <View className="gap-2 border-t border-border pt-3">
                      <Text className="text-xs font-bold uppercase tracking-wide text-accent">
                        Historique mensuel
                      </Text>
                      {monthlyHistory.map(({ key, label, total }) => (
                        <View key={key} className="flex-row items-center justify-between">
                          <Text className="text-sm text-muted">{label}</Text>
                          <Text className="text-sm font-semibold text-text">{formatAmount(total, "EUR")}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </Locked>
              </FadeInView>
            </>
          ) : null}

          <FadeInView delay={140}>
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

          {sortedExpenses.length === 0 ? (
            <FadeInView delay={200}>
              <View className={`${CARD} items-center gap-2`}>
                <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
                  <MaterialCommunityIcons name="wallet-outline" size={22} color={colors.textMuted} />
                </View>
                <Text className="text-sm text-muted">Aucune dépense pour l&apos;instant.</Text>
              </View>
            </FadeInView>
          ) : (
            sortedExpenses.map((expense, i) => (
              <FadeInView key={expense.id} delay={200 + i * 60}>
                <ExpenseCard
                  expense={expense}
                  linkedAppointment={horseAppointments.find((a) => a.id === expense.appointmentId) ?? null}
                  linkedDocument={documents.find((d) => d.id === expense.documentId) ?? null}
                  onDelete={() => confirmDeleteExpense(expense)}
                  onEdit={() => startEditExpense(expense)}
                  onTogglePaid={() => toggleExpensePaid(expense.id)}
                  onAttachReceipt={() => handleAttachReceipt(expense)}
                  onRemoveReceipt={() => linkExpenseDocument(expense.id, null)}
                />
              </FadeInView>
            ))
          )}
        </>
      )}
    </Screen>
    <PickerOverlaySlot />
    </>
  );
}
