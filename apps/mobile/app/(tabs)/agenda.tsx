import { useEffect, useMemo, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { colors } from "@/theme/colors";
import { FadeInView } from "@/components/FadeInView";
import { BackButton } from "@/components/BackButton";
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
  type Expense,
  type ExpenseCategory,
} from "@/agenda/store";
import { APPT_META, EXPENSE_META, expenseCategoryToAppointmentType, formatAmount, capitalize, daysUntilLabel } from "@/agenda/meta";
import { AppointmentForm } from "@/agenda/components/AppointmentForm";
import { AppointmentCard } from "@/agenda/components/AppointmentCard";
import { DocumentForm } from "@/agenda/components/DocumentForm";
import { DocumentCard } from "@/agenda/components/DocumentCard";
import { ExpenseForm } from "@/agenda/components/ExpenseForm";
import { ExpenseCard } from "@/agenda/components/ExpenseCard";
import { SectionSwitcher, AGENDA_SECTIONS, type AgendaSection } from "@/agenda/components/SectionSwitcher";
import { useAppointmentForm } from "@/agenda/hooks/useAppointmentForm";
import { useDocumentForm } from "@/agenda/hooks/useDocumentForm";
import { useExpenseForm } from "@/agenda/hooks/useExpenseForm";

const CARD = "rounded-card bg-surface p-5 shadow-card";

// Titre/sous-titre par section — avant, l'écran affichait toujours "Agenda" /
// "Rendez-vous et documents de {cheval}" quelle que soit la section active
// (ex: Budget affichait un sous-titre parlant de rendez-vous), cf. audit
// pré-publication. Section "journal" retirée (cf. AGENDA_SECTIONS) : elle
// dupliquait l'onglet Journal réel sans qu'aucune navigation n'y mène plus,
// le Horse Hub renvoyant désormais directement vers l'onglet Journal.
const SECTION_META: Record<AgendaSection, { title: string; subtitle: (horseName: string) => string }> = {
  appointments: { title: "Santé & rendez-vous", subtitle: (n) => `Rendez-vous et échéances de soin de ${n}` },
  documents: { title: "Documents", subtitle: (n) => `Coffre-fort numérique de ${n}` },
  finances: { title: "Budget", subtitle: (n) => `Dépenses et budget de ${n}` },
};

export default function AgendaScreen() {
  const { selectedHorse: horse } = useHorses();
  const { isActiveOrTrialing } = useSubscription();
  const {
    appointments,
    documents,
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
    addExpense,
    updateExpense,
    deleteExpense,
    toggleExpensePaid,
    linkExpenseDocument,
  } = useAgenda();
  // Section initiale optionnelle (cf. app/horse/[id]/index.tsx, qui renvoie
  // ici via router.dismissTo avec ?section=... pour ouvrir directement le bon
  // onglet) — ignorée si absente ou invalide, comportement par défaut
  // inchangé pour toute navigation qui n'en passe pas (ex: today.tsx "Voir
  // tout"). dismissTo retrouve l'instance "(tabs)" déjà montée dans la pile
  // plutôt que d'en empiler une nouvelle (cf. horse/[id]/index.tsx) : pas
  // besoin d'une cible de retour explicite ici, `router.back()` (via
  // BackButton par défaut) reste cohérent.
  const { section: sectionParam } = useLocalSearchParams<{ section?: string }>();
  const initialSection = AGENDA_SECTIONS.includes(sectionParam as AgendaSection)
    ? (sectionParam as AgendaSection)
    : "appointments";
  const [section, setSection] = useState<AgendaSection>(initialSection);
  // L'onglet Agenda reste monté entre deux visites (comportement par défaut
  // des Tabs Expo Router) : sans cet ajustement, une deuxième navigation ici
  // avec un ?section= différent (ex: Horse Hub > Budget après Horse Hub >
  // Santé) ne changerait rien, `useState(initialSection)` ne s'exécutant
  // qu'au premier montage. useEffect plutôt que le pattern "ajuster pendant
  // le rendu" utilisé avant (cf. audit pré-publication : ce dernier ne
  // rattrapait pas fiablement un changement de section quand la navigation
  // traverse deux navigateurs différents, Stack racine → Tabs imbriqués,
  // comme depuis le Horse Hub) — moins optimal en théorie, mais correct dans
  // tous les cas plutôt que correct seulement dans certains.
  useEffect(() => {
    if (AGENDA_SECTIONS.includes(sectionParam as AgendaSection)) {
      // Changement de destination explicite (cf. commentaire ci-dessus) —
      // pas une synchronisation dérivée de props à chaque rendu.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSection(sectionParam as AgendaSection);
    }
  }, [sectionParam]);
  const [notifPermission, setNotifPermission] = useState<boolean | null>(null);

  useEffect(() => {
    ensureNotificationPermission()
      .then(setNotifPermission)
      .catch(() => setNotifPermission(false));
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

  // Une seule fois par montage (cf. today.tsx, même correctif, audit perf du
  // 2026-09-09) : "aujourd'hui" ne change pas au sein d'une session, et tout
  // ce qui suit doit dépendre d'une référence stable pour que la mémoïsation
  // en aval serve à quelque chose.
  const today = useMemo(() => daysFromNow(0), []);

  // Rendez-vous et documents sont rattachés à un cheval (cf. agenda/store.tsx)
  // — le partage DP/coach se fait par cheval, donc cet écran ne montre que
  // ceux du cheval actuellement sélectionné. Le coffre-fort (documents) reste
  // privé par cavalier côté RLS (jamais partagé, cf. rls.sql) : horseId n'y
  // sert qu'à filtrer l'affichage, pas l'accès.
  //
  // Mémoïsés à partir d'ici (cf. audit perf du 2026-09-09) : sans ça, taper
  // dans le formulaire de rendez-vous (état local à cet écran) recalculait
  // silencieusement tout le budget à chaque frappe, section budget affichée
  // ou non.
  const horseAppointments = useMemo(
    () => appointments.filter((a) => a.horseId === horse?.id),
    [appointments, horse?.id]
  );
  const horseExpenses = useMemo(() => expenses.filter((e) => e.horseId === horse?.id), [expenses, horse?.id]);

  const upcomingAppts = useMemo(
    () => horseAppointments.filter((a) => a.date >= today).sort((a, b) => a.date.getTime() - b.date.getTime()),
    [horseAppointments, today]
  );
  // Historique complet pour tout le monde, gratuit comme Premium — pas de
  // plafond du type "14 jours en gratuit" (cf. rls.sql appointments_shared,
  // non gaté par abonnement).
  const pastAppts = useMemo(
    () => horseAppointments.filter((a) => a.date < today).sort((a, b) => b.date.getTime() - a.date.getTime()),
    [horseAppointments, today]
  );
  // Prochaines échéances de soin (ex: prochain vaccin) — distinctes de la
  // date du rendez-vous lui-même (cf. Appointment.nextDueDate) : un vaccin
  // fait aujourd'hui a une échéance dans plusieurs mois, qui n'apparaîtrait
  // sinon dans aucune liste triée par `date`.
  const upcomingDueDates = useMemo(
    () =>
      horseAppointments
        .filter((a) => a.nextDueDate && a.nextDueDate >= today)
        .sort((a, b) => a.nextDueDate!.getTime() - b.nextDueDate!.getTime()),
    [horseAppointments, today]
  );

  // Filtrés par cheval sélectionné depuis leur rattachement (cf.
  // Doc.horseId) — avant, tous les documents de tous les chevaux
  // s'affichaient mélangés (cf. audit produit du 2026-09-04).
  const sortedDocs = useMemo(
    () => documents.filter((d) => d.horseId === horse?.id).sort((a, b) => b.date.getTime() - a.date.getTime()),
    [documents, horse?.id]
  );

  const sortedExpenses = useMemo(
    () => [...horseExpenses].sort((a, b) => b.date.getTime() - a.date.getTime()),
    [horseExpenses]
  );
  // Toutes les dépenses sont en EUR pour l'instant (cf. Expense.currency) —
  // un total multi-devises n'aurait pas de sens sans conversion, hors scope.
  const totalExpenses = useMemo(() => sortedExpenses.reduce((sum, e) => sum + e.amount, 0), [sortedExpenses]);
  // Statut payé/à régler Premium (cf. Expense.isPaid) — en gratuit, tout
  // reste "à régler" faute de pouvoir basculer le statut, cf. handleSubmitExpense.
  const paidExpenses = useMemo(
    () => sortedExpenses.filter((e) => e.isPaid).reduce((sum, e) => sum + e.amount, 0),
    [sortedExpenses]
  );
  const pendingExpenses = totalExpenses - paidExpenses;

  // "Combien me coûte réellement mon cheval ?" (cf. brief budget) : totaux
  // période courante + répartition par catégorie + historique mensuel, tous
  // calculés à partir de sortedExpenses (déjà filtré par cheval sélectionné)
  // — aucun état ni requête supplémentaire.
  const now2 = useMemo(() => new Date(), []);
  const monthTotal = useMemo(
    () =>
      sortedExpenses
        .filter((e) => e.date.getFullYear() === now2.getFullYear() && e.date.getMonth() === now2.getMonth())
        .reduce((sum, e) => sum + e.amount, 0),
    [sortedExpenses, now2]
  );
  const yearTotal = useMemo(
    () =>
      sortedExpenses
        .filter((e) => e.date.getFullYear() === now2.getFullYear())
        .reduce((sum, e) => sum + e.amount, 0),
    [sortedExpenses, now2]
  );
  const categoryBreakdown = useMemo(
    () =>
      (Object.keys(EXPENSE_META) as ExpenseCategory[])
        .map((category) => ({
          category,
          total: sortedExpenses.filter((e) => e.category === category).reduce((sum, e) => sum + e.amount, 0),
        }))
        .filter((c) => c.total > 0)
        .sort((a, b) => b.total - a.total),
    [sortedExpenses]
  );
  // 6 derniers mois (mois courant inclus), le plus récent en premier — pas de
  // graphique, juste une liste lisible (cf. principe "présentation simple").
  const monthlyHistory = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now2.getFullYear(), now2.getMonth() - i, 1);
        const total = sortedExpenses
          .filter((e) => e.date.getFullYear() === d.getFullYear() && e.date.getMonth() === d.getMonth())
          .reduce((sum, e) => sum + e.amount, 0);
        return {
          key: `${d.getFullYear()}-${d.getMonth()}`,
          label: capitalize(d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })),
          total,
        };
      }),
    [sortedExpenses, now2]
  );

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

  function confirmDeleteExpense(expense: Expense) {
    Alert.alert("Supprimer cette dépense ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => deleteExpense(expense.id) },
    ]);
  }

  return (
    <>
    <Screen>
      <BackButton />
      <FadeInView>
        <View className="gap-1">
          <Text className="text-3xl font-display tracking-tight text-text">{SECTION_META[section].title}</Text>
          <Text className="text-base text-muted">{SECTION_META[section].subtitle(horse?.name ?? "ton cheval")}</Text>
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
              onPress={() => ensureNotificationPermission().then(setNotifPermission).catch(() => {})}
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
