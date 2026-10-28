import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { FadeInView } from "@/components/FadeInView";
import { CircularProgress } from "@/components/CircularProgress";
import { Screen } from "@/components/Screen";
import { useScrollToOnOpen } from "@/components/useScrollToOnOpen";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { NEVER_RECURRENCE, computeRecurrenceDates } from "@/lib/recurrence";
import { animateNextLayout } from "@/lib/motion";
import { useThemeColors } from "@/theme/ThemeProvider";
import { formatDuration } from "@/lib/dateFormat";
import { useHorses } from "@/horses/store";
import { useSelectableHorses } from "@/horses/useSelectableHorses";
import { HorseSwitcher } from "@/horses/components/HorseSwitcher";
import {
  hiddenTargetsMessage,
  MAX_ENTRIES_PER_SUBMIT,
  needsExplicitHorseChoice,
  resolveTargetHorseIds,
  shouldOfferHorseChoice,
  targetsOutsideView,
} from "@/horses/selectableHorses";
import { useSubscription } from "@/subscription/store";
import { OTHER_OPTION } from "@/onboarding/options";
import { useAgenda, type Appointment, type CompetitionEntry, type ExpenseCategory } from "@/agenda/store";
import { suggestedAppointmentFor as findSuggestedAppointment } from "@/agenda/meta";
import { useSessions, type TrainingSession } from "@/sessions/store";
import { findPlannedSessionToComplete } from "@/sessions/plannedDuplicate";
import { SessionDonePrompt, useSessionDonePrompt } from "@/sessions/useSessionDonePrompt";
import {
  computeSessionStats,
  startOfMonth as statsMonthStart,
  endOfMonth as statsMonthEnd,
} from "@/sessions/stats";
import { AddToggle } from "@/components/FormChips";
import { addMonths, dayHeaderLabel, groupByDay, startOfMonth } from "@/planning/calendar";
import { emptyForm, formFromSession, type SessionForm } from "@/planning/sessionForm";
import { MonthGrid } from "@/planning/components/MonthGrid";
import { SessionFormCard } from "@/planning/components/SessionFormCard";
import { PlanningStatsCard } from "@/planning/components/PlanningStatsCard";
import { INTENSITY_META } from "@/sessions/components/SessionCard";
import {
  buildUnifiedEvents,
  filterUnifiedEvents,
  eventTime,
  eventDays,
  eventHorseId,
  isEventUpcoming,
  isNewPlanningDestination,
  upcomingUnifiedEvents,
  PLANNING_FILTER_VALUES,
  type PlanningFilterValue,
  type UnifiedEvent,
} from "@/planning/unifiedEvents";
import { parseOpenForm, type PlanningOpenForm } from "@/planning/planningDestination";
import { PlanningFilter } from "@/planning/components/PlanningFilter";
import { UnifiedEventCard } from "@/planning/components/UnifiedEventCard";
import { QuickAddSheet, type QuickAddOption } from "@/components/QuickAddSheet";
import { useAppointmentForm } from "@/agenda/hooks/useAppointmentForm";
import { AppointmentForm } from "@/agenda/components/AppointmentForm";
import { ChecklistTemplateCard } from "@/agenda/components/ChecklistTemplateCard";
import { useExpenseForm } from "@/agenda/hooks/useExpenseForm";
import { ExpenseForm } from "@/agenda/components/ExpenseForm";
import { useJournalForm } from "@/agenda/hooks/useJournalForm";
import { JournalForm } from "@/agenda/components/JournalForm";
import { lazyTab } from "@/components/LazyTab";
import { ScreenTitle } from "@/components/ScreenTitle";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";

function PlanningScreen() {
  const colors = useThemeColors();
  const { horses, selectedHorse } = useHorses();
  // Chevaux qu'on peut viser depuis cet écran : possédés et non verrouillés
  // par le palier (cf. horses/selectableHorses.ts pour la règle et ses
  // raisons). Vide ou singleton = rien ne change par rapport à avant.
  const selectableHorses = useSelectableHorses();
  // Filtre d'AFFICHAGE par cheval (null = « Tous »), sur le modèle du Journal
  // — ne change jamais le cheval actif de l'app, contrairement à
  // HorseSwitcher juste à côté. Démarre sur le cheval actif : c'est
  // exactement ce que cet écran montrait avant, « Tous » est un pas
  // supplémentaire et délibéré.
  const [filterHorseId, setFilterHorseId] = useState<string | null>(selectedHorse?.id ?? null);
  // Changer de cheval actif (HorseSwitcher, présent sur cet écran) recadre le
  // filtre sur ce cheval : sans ça, basculer sur un autre cheval ne changerait
  // rien à la liste et donnerait l'impression d'un bouton mort. Même pattern
  // « ajuster l'état pendant le rendu » que journal.tsx (cf. son commentaire
  // sur ?horse=), et non un useEffect.
  const [syncedActiveHorseId, setSyncedActiveHorseId] = useState(selectedHorse?.id ?? null);
  if ((selectedHorse?.id ?? null) !== syncedActiveHorseId) {
    setSyncedActiveHorseId(selectedHorse?.id ?? null);
    setFilterHorseId(selectedHorse?.id ?? null);
  }
  // Le cheval actif peut être un cheval PARTAGÉ (demi-pension, coach), absent
  // de `selectableHorses` — on n'écrit jamais en masse sur le cheval de
  // quelqu'un d'autre, cf. horses/selectableHorses.ts. Sans l'ajouter aux
  // puces, le Planning s'ouvrirait sur ses événements avec aucune puce
  // sélectionnée, ce qui donnerait un filtre cassé. Ajout d'AFFICHAGE
  // uniquement : « Tous » reste limité aux chevaux possédés (cf.
  // horseSessions/horseAppointments).
  const filterChipHorses = useMemo(
    () =>
      selectedHorse && !selectableHorses.some((h) => h.id === selectedHorse.id)
        ? [...selectableHorses, selectedHorse]
        : selectableHorses,
    [selectableHorses, selectedHorse]
  );
  // « Tous » n'a de sens que s'il y a au moins DEUX chevaux proposables à
  // mêler. Compte gratuit avec un cheval possédé et un cheval partagé : une
  // puce « Tous » afficherait les événements du seul cheval possédé sous le
  // nom du cheval partagé actif.
  const canShowAllHorses = selectableHorses.length > 1;
  // Filtre EFFECTIF (null = « Tous »), dérivé de l'état brut pour qu'un état
  // devenu invalide ne survive pas : un cheval verrouillé depuis (fin d'essai
  // Premium) ou supprimé ailleurs n'est plus dans les puces, et « Tous » sans
  // deux chevaux proposables retombe sur le cheval actif.
  const activeFilterId =
    filterHorseId && filterChipHorses.some((h) => h.id === filterHorseId)
      ? filterHorseId
      : filterHorseId === null && canShowAllHorses
        ? null
        : (selectedHorse?.id ?? null);
  const filterHorse = activeFilterId ? horses.find((h) => h.id === activeFilterId) ?? null : null;
  // Cheval qui recevra une entrée créée depuis cet écran quand l'utilisateur
  // ne choisit rien d'autre : celui du filtre s'il en cible un, sinon le
  // cheval actif — même règle que le Journal, jamais une troisième notion de
  // « cheval courant ».
  const targetHorse = filterHorse ?? selectedHorse;
  const showingAllHorses = activeFilterId === null;
  // Cible par défaut d'une création tant que rien n'est coché dans le
  // formulaire : le cheval ciblé (filtre, ou cheval actif), et AUCUN en vue
  // « Tous ». Cette vue mêle l'écurie entière sans désigner personne : y
  // créer sans rien cocher voudrait dire soit le seul cheval actif (bug du
  // 2026-09-20), soit tous — une poignée d'entrées créées d'un appui, que la
  // suppression ne reprend qu'une par une. On demande donc de cocher (le
  // sélecteur est de toute façon affiché, cf. shouldOfferHorseChoice, et la
  // soumission refuse tant que rien ne l'est).
  const defaultHorseIds = useMemo(
    () => (showingAllHorses ? [] : targetHorse ? [targetHorse.id] : []),
    [showingAllHorses, targetHorse]
  );
  const { isActiveOrTrialing } = useSubscription();
  const { sessions, addSession, updateSession, deleteSession, toggleCompleted } = useSessions();
  // Cf. today.tsx : cocher une séance propose d'en dire un mot.
  const { toggleSessionDone, prompted, dismissPrompt } = useSessionDonePrompt();
  const {
    appointments,
    addAppointment,
    updateAppointment,
    deleteAppointment,
    checklistTemplate,
    saveChecklistTemplate,
    saveResult,
    toggleChecklistItem,
    addChecklistItem,
    removeChecklistItem,
    addCompetitionEntry,
    updateCompetitionEntry,
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
  /** Verrou de soumission. handleSubmit est synchrone : deux appuis
   * rapprochés sur « Ajouter » sont deux événements distincts qui lisent tous
   * deux l'état d'avant le rendu suivant, et créent deux séances identiques
   * — indiscernables ensuite, et à supprimer une par une. Une ref, et non un
   * state : seule une écriture immédiatement visible protège la fenêtre entre
   * les deux appuis (un setState ne serait lu qu'au rendu suivant).
   *
   * Il n'est PAS relâché après une soumission réussie — le formulaire est
   * alors fermé — mais à chaque (ré)ouverture du formulaire et si la
   * soumission a été refusée. La réouverture est détectée par un effet (cf.
   * plus bas) et non dans `openCreateForm` : celle-ci est aussi appelée
   * PENDANT le rendu (arrivée de ?openForm=session), où écrire dans une ref
   * est interdit. */
  const sessionSubmitLock = useRef(false);
  // Détails facultatifs (heure, intensité, répétition, notes) repliés par
  // défaut : la saisie courante tient dans type + date + durée, et déplier
  // reste à un appui. L'état vit ici et non dans `form` : il ne décrit pas la
  // séance, et `emptyForm()` le remettrait à zéro entre deux créations.
  const [showSessionDetails, setShowSessionDetails] = useState(false);
  // Confirmation d'enregistrement affichée en haut de l'écran quelques
  // secondes (cf. son rendu plus bas) : le formulaire se contentait de
  // disparaître, sans dire ce qui avait été créé ni où le retrouver.
  const [savedNotice, setSavedNotice] = useState<{ text: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Filtre initial optionnel (cf. app/horse/[id]/index.tsx, dont les cartes
  // Entraînement/Concours poussent directement ici avec ?filter=... — cf.
  // audit crash du 2026-09-05 round 2, plus d'écran intermédiaire) — "all"
  // par défaut si absent/invalide, comportement inchangé pour toute
  // navigation qui n'en passe pas.
  const {
    filter: filterParam,
    openForm: openFormParam,
    ts: openFormTs,
  } = useLocalSearchParams<{
    filter?: string;
    openForm?: string;
    ts?: string;
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
    if (isNewPlanningDestination(syncedFilterParam, filterParam)) {
      setFilter(filterParam as PlanningFilterValue);
      // Ces destinations viennent d'un écran cadré sur le cheval ACTIF (fiche
      // cheval, qui le sélectionne à son ouverture) : la vue « Tous » gardée
      // d'une visite précédente ne doit pas s'y substituer.
      setFilterHorseId(selectedHorse?.id ?? null);
    }
  }
  // Même pattern que syncedFilterParam ci-dessus, pour Quick Add "Séance"
  // depuis Accueil/Horse Hub (cf. today.tsx et horse/[id]/index.tsx, qui
  // renvoient ici avec ?openForm=session) : ouvre directement le formulaire
  // de création de séance, déjà scoped au cheval actif (selectedHorse),
  // sans reproduire ce formulaire ailleurs. Clé combinant `openForm` ET `ts`
  // (horodatage unique posé par l'appelant) plutôt que `openForm` seul (cf.
  // audit crash du 2026-09-05, Bug 1) : Planning reste monté entre deux
  // visites, donc comparer seulement "session" === "session" ignorerait tout
  // appui répété sur le CTA une fois le premier déjà consommé.
  const openFormKey = `${openFormParam ?? ""}:${openFormTs ?? ""}`;
  // Part de la clé « vide », pas de la clé reçue : quand le Planning est
  // monté POUR la première fois par un « Planifier une séance » (onglet
  // jamais visité depuis le lancement), la demande d'ouverture arrive dès ce
  // premier rendu — la prendre comme état initial la marquait comme déjà
  // traitée, et le formulaire ne s'ouvrait pas.
  const [syncedOpenFormKey, setSyncedOpenFormKey] = useState(":");
  // Autres formulaires demandés à l'arrivée (« + » du Journal ou de
  // l'onglet Chevaux, cf. planningDestination.openFormForQuickAdd) : ouverts
  // par un effet, une fois le rendu passé — leurs états vivent dans des hooks
  // déclarés plus bas (useAppointmentForm…).
  const [pendingOpenForm, setPendingOpenForm] = useState<PlanningOpenForm | null>(null);
  if (openFormKey !== syncedOpenFormKey) {
    setSyncedOpenFormKey(openFormKey);
    const requested = parseOpenForm(openFormParam);
    if (openFormParam === "session") {
      // « Planifier une séance » vient de l'Accueil ou d'une fiche cheval, donc
      // pour le cheval actif — pas pour toute l'écurie si la vue « Tous »
      // était restée sélectionnée depuis une visite précédente.
      setFilterHorseId(selectedHorse?.id ?? null);
      openCreateForm();
    } else if (requested) {
      setFilterHorseId(selectedHorse?.id ?? null);
      setPendingOpenForm(requested);
    }
  }
  // Une nouvelle soumission redevient légitime dès que le formulaire
  // s'ouvre — quel que soit le chemin d'ouverture (appui, ou arrivée de
  // ?openForm=session traitée pendant le rendu). Un effet est le seul endroit
  // où toucher la ref sans enfreindre les règles de React.
  useEffect(() => {
    if (showForm) sessionSubmitLock.current = false;
  }, [showForm]);

  // Efface la confirmation après quelques secondes. L'objet `savedNotice` est
  // recréé à chaque enregistrement (même texte compris), donc deux séances
  // ajoutées à la suite relancent bien le compte à rebours.
  useEffect(() => {
    if (!savedNotice) return;
    const timer = setTimeout(() => setSavedNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [savedNotice]);

  const [viewMode, setViewMode] = useState<"list" | "month">("list");
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [showStats, setShowStats] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState<"month" | "all">("month");
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  // Seul le setter est nécessaire (cf. useAppointmentForm), Planning
  // n'affiche pas de bannière de permission notifications contrairement à
  // agenda.tsx.
  const [, setNotifPermission] = useState<boolean | null>(null);

  // `filterHorseId` null = « Tous les chevaux » : on garde alors tout ce qui
  // appartient à un cheval proposable (possédé, non verrouillé — cf.
  // horses/selectableHorses.ts), et pas la liste brute : une entrée d'un
  // cheval verrouillé par le palier gratuit n'a pas à réapparaître ici.
  const selectableHorseIds = useMemo(() => selectableHorses.map((h) => h.id), [selectableHorses]);
  // Chevaux dont la liste ci-dessous affiche les événements — l'écurie
  // proposable en vue « Tous », le cheval ciblé sinon. Distinct de
  // `defaultHorseIds` (vide en vue « Tous ») : sert à savoir si une entrée
  // créée sera visible ici ou semblera perdue (cf. targetsOutsideView).
  const visibleHorseIds = useMemo(
    () => (activeFilterId ? [activeFilterId] : selectableHorseIds),
    [activeFilterId, selectableHorseIds]
  );
  const horseSessions = useMemo(
    () =>
      sessions.filter((s) =>
        activeFilterId ? s.horseId === activeFilterId : s.horseId !== null && selectableHorseIds.includes(s.horseId)
      ),
    [sessions, activeFilterId, selectableHorseIds]
  );
  const horseAppointments = useMemo(
    () =>
      appointments.filter((a) =>
        activeFilterId ? a.horseId === activeFilterId : a.horseId !== null && selectableHorseIds.includes(a.horseId)
      ),
    [appointments, activeFilterId, selectableHorseIds]
  );
  // Une seule fois par montage (cf. today.tsx, même correctif,
  // audit perf du 2026-09-09).
  const today = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()), [today]);

  // Statistiques simples (pas d'IA, cf. src/sessions/stats.ts) — "Toujours"
  // couvre depuis la plus ancienne séance du cheval jusqu'à aujourd'hui.
  // Restent volontairement propres aux séances (cf. brief §1 : chaque type
  // d'événement garde ses informations propres) — pas de "stats unifiées".
  const statsFrom = useMemo(
    () =>
      statsPeriod === "month"
        ? statsMonthStart(today)
        : horseSessions.reduce((min, s) => (s.date < min ? s.date : min), today),
    [statsPeriod, today, horseSessions]
  );
  const statsTo = useMemo(() => (statsPeriod === "month" ? statsMonthEnd(today) : today), [statsPeriod, today]);
  const sessionStats = useMemo(
    () => computeSessionStats(horseSessions, statsFrom, statsTo),
    [horseSessions, statsFrom, statsTo]
  );

  // Lundi de la semaine en cours, même convention que Today (0 = lundi).
  const weekOffset = useMemo(() => (today.getDay() + 6) % 7, [today]);
  const weekStart = useMemo(() => {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - weekOffset);
    return d;
  }, [todayStart, weekOffset]);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    return d;
  }, [weekStart]);
  const weekSessions = useMemo(
    () => horseSessions.filter((s) => s.date >= weekStart && s.date < weekEnd),
    [horseSessions, weekStart, weekEnd]
  );
  const weekDone = useMemo(() => weekSessions.filter((s) => s.completed).length, [weekSessions]);
  const weekMinutes = useMemo(
    () => weekSessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0),
    [weekSessions]
  );

  // Unification d'affichage seulement (cf. plan Phase 3 Étape 3) : séances et
  // rendez-vous restent deux collections séparées côté store, buildUnifiedEvents
  // ne fait que les envelopper dans un type commun pour trier/regrouper/filtrer
  // une seule liste (cf. src/planning/unifiedEvents.ts).
  const unifiedEvents = useMemo(
    () => buildUnifiedEvents(horseSessions, horseAppointments),
    [horseSessions, horseAppointments]
  );
  const filteredEvents = useMemo(() => filterUnifiedEvents(unifiedEvents, filter), [unifiedEvents, filter]);

  // Vue mensuelle (cf. MonthGrid) : regroupe les événements déjà filtrés par
  // jour pour poser les puces de la grille et la liste du jour sélectionné —
  // seulement utile en vue mois, jamais calculé en vue liste (cf. audit perf
  // du 2026-09-09).
  const eventsByDay = useMemo(() => {
    if (viewMode !== "month") return new Map<string, UnifiedEvent[]>();
    const map = new Map<string, UnifiedEvent[]>();
    for (const e of filteredEvents) {
      // Un concours de plusieurs jours apparaît sur chacun de ses jours.
      for (const day of eventDays(e)) {
        const key = day.toDateString();
        map.set(key, [...(map.get(key) ?? []), e]);
      }
    }
    return map;
  }, [filteredEvents, viewMode]);
  const selectedDayEvents = useMemo(
    () =>
      (eventsByDay.get(selectedDay.toDateString()) ?? []).sort((a, b) => eventTime(a).localeCompare(eventTime(b))),
    [eventsByDay, selectedDay]
  );

  const upcoming = useMemo(() => upcomingUnifiedEvents(filteredEvents, todayStart), [filteredEvents, todayStart]);
  const done = useMemo(
    () =>
      filteredEvents
        .filter((e) => !isEventUpcoming(e, todayStart))
        .sort((a, b) => b.date.getTime() - a.date.getTime()),
    [filteredEvents, todayStart]
  );

  const upcomingGroups = useMemo(() => groupByDay(upcoming), [upcoming]);
  const doneGroups = useMemo(() => groupByDay(done.slice(0, 20)), [done]);

  const sessionHandlers = {
    onToggleDone: (s: TrainingSession) => toggleSessionDone(s),
    onEdit: (s: TrainingSession) => openEditForm(s),
    onDuplicate: (s: TrainingSession) => handleDuplicate(s),
    onDelete: (s: TrainingSession) => confirmDelete(s),
  };

  // « Modifier » un rendez-vous ouvre le formulaire de CET écran, qui est le
  // même composant partout (AppointmentForm + useAppointmentForm, déjà monté
  // ici pour la création). Avant, l'action renvoyait vers l'écran Agenda :
  // il fallait changer d'onglet pour corriger une heure, et c'est ce renvoi
  // qui justifiait de garder Agenda en vie. Les autres actions (checklist,
  // résultat, épreuves, suppression) restent de simples appels aux mutateurs
  // d'agenda/store.tsx, sans nouvelle logique.
  const appointmentHandlers = {
    onEdit: (a: Appointment) => startEditAppt(a),
    // Même confirmation que pour une séance ou un souvenir : la suppression
    // d'un rendez-vous (et de ses rappels) partait au premier toucher, et le
    // balayage de la carte la rend encore plus facile à déclencher.
    onDelete: (a: Appointment) =>
      Alert.alert(t("Supprimer ce rendez-vous ?"), t("Ses rappels seront aussi annulés. Cette action est définitive."), [
        { text: t("Annuler"), style: "cancel" },
        { text: t("Supprimer"), style: "destructive", onPress: () => deleteAppointment(a) },
      ]),
    onSaveResult: (a: Appointment, result: string) => saveResult(a.id, result),
    onToggleChecklistItem: (a: Appointment, itemId: string) => toggleChecklistItem(a.id, itemId),
    onAddChecklistItem: (a: Appointment, label: string) => addChecklistItem(a.id, label),
    onRemoveChecklistItem: (a: Appointment, itemId: string) => removeChecklistItem(a.id, itemId),
    onAddCompetitionEntry: (a: Appointment, entry: Omit<CompetitionEntry, "id" | "result">) => addCompetitionEntry(a.id, entry),
    onUpdateCompetitionEntry: (a: Appointment, entryId: string, patch: Partial<Omit<CompetitionEntry, "id">>) =>
      updateCompetitionEntry(a.id, entryId, patch),
    onDeleteCompetitionEntry: (a: Appointment, entryId: string) => deleteCompetitionEntry(a.id, entryId),
  };

  const {
    showApptForm,
    setShowApptForm,
    apptForm,
    setApptForm,
    submittingAppt,
    editingApptId,
    reminderUnlocked,
    startEditAppt,
    cancelApptForm,
    handleSubmitAppointment,
    addApptFormEntry,
    updateApptFormEntry,
    removeApptFormEntry,
  } = useAppointmentForm({
    horse: targetHorse ?? null,
    selectableHorses,
    defaultHorseIds,
    visibleHorseIds,
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
  } = useExpenseForm({
    addExpense,
    updateExpense,
    addDocument,
    linkExpenseDocument,
    isActiveOrTrialing,
    horse: targetHorse ?? null,
    selectableHorses,
    defaultHorseIds,
    visibleHorseIds,
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
  } = useJournalForm({
    // Suit le filtre quand il cible un cheval, sinon fallback d'origine sur
    // le cheval actif — exactement ce que fait l'onglet Journal (cf.
    // (tabs)/journal.tsx).
    addJournalEntry: (entry) => addJournalEntry(activeFilterId ? { ...entry, horseId: activeFilterId } : entry),
    updateJournalEntry,
    onEditStart: () => setExpandedId(null),
  });

  const { scrollRef, onAnchorLayout: onFormLayout } = useScrollToOnOpen(
    showForm || showApptForm || showExpenseForm || showJournalForm
  );

  // Ferme tout formulaire de création/édition resté ouvert d'une visite
  // précédente dès qu'une NOUVELLE destination explicite arrive depuis Horse
  // Hub (?filter=session ou ?filter=concours) — cf. bug "Horse Hub >
  // Entraînement puis Concours affiche encore le formulaire Séance" (audit
  // du 2026-09-05, round 4). Planning reste monté entre deux visites
  // (dismissTo ne le démonte pas, cf. syncedFilterParam plus haut), donc un
  // formulaire ouvert avant de quitter (Nouvelle séance, ou un Quick Add
  // rendez-vous/dépense/journal déclenché depuis Planning) restait affiché
  // par-dessus la liste filtrée demandée : `showForm`/`showApptForm`/
  // `showExpenseForm`/`showJournalForm` n'étaient rendus prioritaires que
  // par leur ordre dans le JSX (cf. plus bas), jamais réinitialisés par la
  // seule arrivée d'un nouveau ?filter=. État suivi séparément de
  // syncedFilterParam (et placé après les hooks ci-dessus, dont dépendent
  // cancelApptForm/cancelExpenseForm/cancelJournalForm) : les deux ajustent
  // l'état pendant le rendu sur le même changement de filterParam sans se
  // marcher dessus (cf. react.dev/learn/you-might-not-need-an-effect).
  const [formsResetForFilterParam, setFormsResetForFilterParam] = useState(filterParam);
  if (filterParam !== formsResetForFilterParam) {
    setFormsResetForFilterParam(filterParam);
    if (isNewPlanningDestination(formsResetForFilterParam, filterParam)) {
      // Le verrou de soumission n'est PAS touché ici : ce bloc s'exécute
      // pendant le rendu, où lire ou écrire une ref est interdit (React ne
      // garantit alors rien). Inutile de toute façon — ce reset ferme le
      // formulaire, et openCreateForm/openEditForm relâchent le verrou à la
      // prochaine ouverture.
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm());
      setShowSessionDetails(false);
      cancelApptForm();
      cancelExpenseForm();
      cancelJournalForm();
    }
  }

  // Même logique de rapprochement que le Horse Hub et le budget d'un
  // cheval (cf. app/horse/[id]/budget.tsx) — dupliquée
  // Suggestion de rapprochement pour le formulaire de dépense (cf.
  // agenda/meta.ts suggestedAppointmentFor, partagé avec today.tsx/Horse Hub).
  function suggestedAppointmentFor(category: ExpenseCategory, horseId: string | null): Appointment | null {
    // Le rapprochement lie une dépense au rendez-vous du MÊME cheval que
    // celui qu'elle vise (`horseId`, coché dans le formulaire) — pas au cheval
    // actif ni à ceux mêlés par la vue « Tous » : sinon une dépense pour B se
    // liait au vaccin de A.
    return findSuggestedAppointment(
      appointments.filter((a) => a.horseId === (horseId ?? targetHorse?.id ?? null)),
      category
    );
  }

  function handleQuickAdd(option: QuickAddOption | PlanningOpenForm) {
    setQuickAddVisible(false);
    switch (option) {
      case "direct":
        // Écran modal (pas un onglet) : il se pousse par-dessus l'onglet courant.
        router.push("/ride");
        return;
      case "seance":
      case "session":
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
    setShowSessionDetails(false);
    setShowForm(true);
  }

  function openEditForm(session: TrainingSession) {
    setEditingId(session.id);
    setForm(formFromSession(session));
    setExpandedId(null);
    // En édition, tout ce qui a été saisi doit rester visible : replier des
    // champs déjà renseignés les ferait passer pour perdus.
    setShowSessionDetails(true);
    setShowForm(true);
  }

  function handleSubmit() {
    if (sessionSubmitLock.current) return;
    sessionSubmitLock.current = true;
    // Refusée (date manquante, aucun cheval visé, plafond dépassé) : rien n'a
    // été écrit et le formulaire reste ouvert, donc le bouton doit redevenir
    // utilisable une fois la saisie corrigée.
    if (!submitSession()) sessionSubmitLock.current = false;
  }

  /** Corps de handleSubmit. Retourne `false` sur chacun de ses refus, pour
   * que le verrou ci-dessus sache s'il doit être relâché. */
  function submitSession(): boolean {
    if (!form.date) return false;
    // `activityType` reste la valeur technique déjà choisie (jamais "Autre") ;
    // `customActivityLabel` ne porte le texte que si "Autre" est réellement
    // sélectionné — même règle que Goal.type/customType.
    const customActivityLabel = form.typeSelection === OTHER_OPTION ? form.customActivityLabel.trim() || null : null;
    let hiddenNames: string[] = [];
    if (editingId) {
      const existing = horseSessions.find((s) => s.id === editingId);
      if (!existing) return false;
      updateSession({
        ...existing,
        activityType: form.activityType,
        customActivityLabel,
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
      //
      // Chevaux × dates, comme pour les rendez-vous (cf. useAppointmentForm) :
      // une séance complète et indépendante par cheval visé. Sans choix
      // explicite, la cible par défaut de la vue s'applique — TOUS les chevaux
      // en vue « Tous », le cheval ciblé sinon (jamais le seul cheval actif
      // quand « Tous » est posé, bug du 2026-09-20).
      const sessionHorseIds = shouldOfferHorseChoice(selectableHorses, defaultHorseIds)
        ? resolveTargetHorseIds(form.horseIds, selectableHorses, defaultHorseIds)
        : defaultHorseIds;
      // Ceinture du bouton désactivé (cf. missingHorseChoice) : en vue
      // « Tous », aucun cheval n'est visé tant que rien n'est coché.
      if (missingHorseChoice) {
        Alert.alert(t("Pour quel cheval ?"), t("Choisis au moins un cheval avant d'enregistrer cette séance."));
        return false;
      }
      const sessionTargets = sessionHorseIds.length > 0 ? sessionHorseIds : [targetHorse?.id ?? null];
      // Une séance déjà faite décrit un fait passé : la répéter dans le futur
      // n'a pas de sens, et le champ est masqué dans ce cas (cf. le JSX) —
      // ignoré ici aussi, au cas où une valeur resterait d'avant la bascule.
      const occurrenceDates = computeRecurrenceDates(form.date, form.completed ? NEVER_RECURRENCE : form.recurrence);
      // Même garde-fou que pour les rendez-vous (cf. MAX_ENTRIES_PER_SUBMIT).
      // La récurrence plafonne à 52 occurrences PAR cheval (cf.
      // lib/recurrence.ts) : sans cette borne, 5 chevaux en vue « Tous »
      // faisaient 260 séances en un seul appui — autant d'écritures locales et
      // de push cloud simultanés, best-effort et sans reprise (cf.
      // sessions/store.tsx). Le bouton est déjà désactivé au-delà, ceci n'est
      // qu'une ceinture.
      if (sessionTargets.length * occurrenceDates.length > MAX_ENTRIES_PER_SUBMIT) {
        Alert.alert(
          t("Trop de séances d'un coup"),
          t("Une création est limitée à {MAX_ENTRIES_PER_SUBMIT} séances (chevaux × répétitions). Réduis la répétition ou le nombre de chevaux.", { MAX_ENTRIES_PER_SUBMIT: MAX_ENTRIES_PER_SUBMIT })
        );
        return false;
      }
      // Chevaux AFFICHÉS, et non cible par défaut : en vue « Tous » celle-ci
      // est vide alors que la vue montre toute l'écurie (cf. targetsOutsideView).
      hiddenNames = targetsOutsideView(sessionHorseIds, visibleHorseIds).map(
        (id) => selectableHorses.find((h) => h.id === id)?.name ?? t("un autre cheval")
      );
      for (const sessionHorseId of sessionTargets) {
        for (const date of occurrenceDates) {
          addSession({
            horseId: sessionHorseId,
            activityType: form.activityType,
            customActivityLabel,
            date,
            time: form.time,
            durationMinutes: form.durationMinutes,
            intensity: form.intensity,
            notes: form.notes,
            completed: form.completed,
          });
        }
      }
    }
    const createdCount = editingId ? 0 : sessionCreateCount;
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    setShowSessionDetails(false);
    setSavedNotice({
      text: editingId
        ? t("Séance modifiée.")
        : createdCount > 1
          ? t("{createdCount} séances enregistrées.", { createdCount: createdCount })
          : form.completed
            ? t("Séance enregistrée comme faite.")
            : t("Séance planifiée."),
    });
    // Une séance créée pour un cheval que la vue n'affiche pas semblerait
    // perdue : on le dit (cf. hiddenTargetsMessage). L'alerte prime sur la
    // confirmation discrète ci-dessus, elle demande un accusé de réception.
    if (hiddenNames.length > 0) Alert.alert(t("Séance enregistrée"), hiddenTargetsMessage(hiddenNames));
    return true;
  }

  function handleDuplicate(session: TrainingSession) {
    const date = new Date(session.date);
    date.setDate(date.getDate() + 7);
    addSession({
      // Le cheval de la séance dupliquée, jamais le cheval courant : en vue
      // « Tous les chevaux », on duplique celle qu'on a sous les yeux.
      horseId: session.horseId,
      activityType: session.activityType,
      customActivityLabel: session.customActivityLabel,
      date,
      time: session.time,
      durationMinutes: session.durationMinutes,
      intensity: session.intensity,
      notes: session.notes,
    });
  }

  /** Nom à afficher en pastille sur un événement, en vue « Tous les
   * chevaux » seulement — null ailleurs, la liste ne portant alors que sur un
   * cheval déjà nommé dans l'en-tête. */
  function eventHorseName(event: UnifiedEvent): string | null {
    if (!showingAllHorses) return null;
    const horseId = eventHorseId(event);
    return selectableHorses.find((h) => h.id === horseId)?.name ?? null;
  }

  function confirmDelete(session: TrainingSession) {
    Alert.alert(t("Supprimer cette séance ?"), t("Cette action est définitive."), [
      { text: t("Annuler"), style: "cancel" },
      { text: t("Supprimer"), style: "destructive", onPress: () => deleteSession(session.id) },
    ]);
  }

  // Nombre de séances que la soumission va créer : occurrences × chevaux
  // visés. Même calcul que handleSubmit, sinon le bouton mentirait.
  const sessionOccurrenceCount =
    form.recurrence.mode === "custom" && form.date ? computeRecurrenceDates(form.date, form.recurrence).length : 1;
  const sessionHorseCount =
    editingId || !shouldOfferHorseChoice(selectableHorses, defaultHorseIds)
      ? 1
      : Math.max(1, resolveTargetHorseIds(form.horseIds, selectableHorses, defaultHorseIds).length);
  const sessionCreateCount = sessionOccurrenceCount * sessionHorseCount;
  /** Ce que contiennent les détails repliés, résumé sur la ligne qui les
   * déplie. Les replier ne doit pas rendre invisible ce qui sera enregistré :
   * l'intensité est préremplie (« Modérée »), et une séance partirait avec
   * cette valeur sans que rien à l'écran ne l'ait montrée. */
  const sessionDetailsSummary = [
    form.time.trim() ? form.time.trim() : t("sans heure"),
    t("intensité {v}", { v: INTENSITY_META[form.intensity].label.toLowerCase() }),
    form.notes.trim() ? t("avec note") : t("sans note"),
    !editingId && !form.completed && form.recurrence.mode === "custom" ? t("répétée") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  // Vue « Tous » sans aucune case cochée : rien n'est visé, le bouton reste
  // désactivé (même règle que les formulaires rendez-vous/dépense).
  const missingHorseChoice = !editingId && needsExplicitHorseChoice(form.horseIds, selectableHorses, defaultHorseIds);
  /** Séance déjà planifiée que cette saisie ferait doublonner (cf.
   * findPlannedSessionToComplete pour la règle et ses garde-fous) — cherchée
   * dans TOUTES les séances et pas seulement celles de la vue : la séance
   * prévue existe indépendamment du filtre affiché. Jamais en édition. */
  const plannedSessionToComplete = useMemo(() => {
    if (editingId) return null;
    const targetIds = shouldOfferHorseChoice(selectableHorses, defaultHorseIds)
      ? resolveTargetHorseIds(form.horseIds, selectableHorses, defaultHorseIds)
      : defaultHorseIds;
    return findPlannedSessionToComplete(sessions, targetIds, form.date, form.completed);
  }, [editingId, form.completed, form.date, form.horseIds, selectableHorses, defaultHorseIds, sessions]);
  // Cf. handleSubmit : au-delà, la soumission refuse. Le bouton le dit avant,
  // plutôt que de laisser l'utilisateur buter sur une alerte (même traitement
  // que le formulaire de rendez-vous, cf. AppointmentForm `overLimit`).
  const sessionOverLimit = !editingId && sessionCreateCount > MAX_ENTRIES_PER_SUBMIT;

  const anyFormOpen = showForm || showApptForm || showExpenseForm || showJournalForm;

  useEffect(() => {
    if (!pendingOpenForm) return;
    // Ouverture demandée par la navigation (cf. pendingOpenForm plus haut) :
    // un état posé une fois, pas une synchronisation à chaque rendu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingOpenForm(null);
    handleQuickAdd(pendingOpenForm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOpenForm]);

  return (
    <>
    <Screen scrollRef={scrollRef}>
      <FadeInView>
        <ScreenTitle
          title={t("Planning")}
          subtitle={
            showingAllHorses
              ? t("La vie équestre de toute l'écurie, en un seul endroit")
              : t("La vie équestre de {v}, en un seul endroit", { v: filterHorse?.name ?? selectedHorse?.name ?? "ton cheval" })
          }
          // Un seul formulaire à la fois : le « + » s'efface tant qu'un ajout
          // ou une modification est en cours.
          onAdd={anyFormOpen ? undefined : () => setQuickAddVisible(true)}
          addLabel={t("Ajouter au planning")}
        />
      </FadeInView>

      {/* Confirmation d'enregistrement — discrète et éphémère (cf.
          savedNotice) : dit ce qui vient d'être écrit sans exiger d'accusé de
          réception, contrairement aux Alert réservées aux cas qui demandent
          une décision. */}
      <SessionDonePrompt session={prompted} onDismiss={dismissPrompt} />

      {savedNotice ? (
        <View className="flex-row items-center gap-2 rounded-card bg-success/15 px-4 py-3">
          <MaterialCommunityIcons name="check-circle-outline" size={17} color={colors.success} />
          <Text className="flex-1 text-sm font-semibold text-text">{savedNotice.text}</Text>
        </View>
      ) : null}

      {/* UN seul sélecteur : choisir un cheval (qui devient le cheval actif
          de toute l'app, comme sur l'Accueil) ou « Tous ». Il y avait ici une
          rangée d'avatars ET une rangée de puces, plus une phrase pour
          expliquer la différence entre « cheval actif » et « cheval du
          filtre ». « Tous » reste réservé aux écuries d'au moins deux chevaux
          proposables (cf. canShowAllHorses), et le cheval qui recevra un
          ajout s'affiche dans le formulaire lui-même (cf. HorseTargetNotice,
          HorseMultiSelect). */}
      {horses.length > 1 ? (
        <FadeInView delay={20}>
          <HorseSwitcher
            allOption={
              canShowAllHorses ? { selected: showingAllHorses, onSelect: () => setFilterHorseId(null) } : undefined
            }
            selectedId={activeFilterId}
            onSelect={(id) => setFilterHorseId(id)}
          />
        </FadeInView>
      ) : null}

      <FadeInView delay={20}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row gap-2 rounded-full bg-surface p-1">
            {(["list", "month"] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => setViewMode(mode)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: viewMode === mode }}
                className={`rounded-full px-4 py-1.5 ${viewMode === mode ? "bg-primary" : ""}`}
              >
                <Text className={`text-sm font-semibold ${viewMode === mode ? "text-on-primary" : "text-muted"}`}>
                  {mode === "list" ? t("Liste") : t("Mois")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View className="flex-row items-center gap-2">
          {/* Bibliothèque d'exercices (cf. app/library.tsx). */}
          <TouchableOpacity
            onPress={() => router.push("/library")}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t("Bibliothèque d'exercices")}
            className="flex-row items-center gap-1.5 rounded-full bg-surface px-3.5 py-2"
          >
            <MaterialCommunityIcons name="book-open-variant" size={16} color={colors.primary} />
            <Text className="text-sm font-semibold text-primary">{t("Exercices")}</Text>
          </TouchableOpacity>
          {/* Les statistiques étaient une carte repliée à part, qui prenait
              une ligne entière même fermée : un bouton suffit pour l'ouvrir.
              Absent en vue « Tous » (cf. le commentaire de la carte). */}
          {showingAllHorses ? null : (
            <TouchableOpacity
              onPress={() => {
                animateNextLayout();
                setShowStats((v) => !v);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ expanded: showStats }}
              className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-2 ${
                showStats ? "bg-primary" : "bg-surface"
              }`}
            >
              <MaterialCommunityIcons
                name="chart-box-outline"
                size={16}
                color={showStats ? colors.textOnPrimary : colors.primary}
              />
              <Text className={`text-sm font-semibold ${showStats ? "text-on-primary" : "text-primary"}`}>
                {t("Statistiques")}
              </Text>
            </TouchableOpacity>
          )}
          </View>
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
              <Text className="text-sm font-bold uppercase tracking-wide text-on-primary/80">
                {t("Cette semaine")}{showingAllHorses ? t(" · toute l'écurie") : ""}
              </Text>
              <Text className="text-[15px] leading-5 text-on-primary">
                {t("{n} séance{v} faite{v} · {duration} au programme", {
                  n: weekDone,
                  v: weekDone > 1 ? "s" : "",
                  duration: formatDuration(weekMinutes),
                })}
              </Text>
            </View>
          </View>
        </FadeInView>
      ) : null}

      {/* Statistiques masquées en vue « Tous les chevaux » : `perWeek` et
          `restDays` sont des notions PAR cheval (cf. sessions/stats.ts) —
          « 4 jours de repos » agrégé sur trois chevaux ne veut rien dire, et
          afficher un chiffre faux serait pire que ne rien afficher. Elles
          reviennent dès qu'une puce cible un cheval. */}
      {showingAllHorses || !showStats ? null : (
      <FadeInView>
        <PlanningStatsCard stats={sessionStats} period={statsPeriod} onChangePeriod={setStatsPeriod} />
      </FadeInView>
      )}

      {/* « Modifier » depuis la liste plus bas ouvre le formulaire ici : on
          y ramène l'écran (cf. useScrollToOnOpen). */}
      <View onLayout={onFormLayout}>
      <FadeInView delay={60}>
        {showForm ? (
          <SessionFormCard
            form={form}
            setForm={setForm}
            editing={!!editingId}
            selectableHorses={selectableHorses}
            defaultHorseIds={defaultHorseIds}
            offerHorseChoice={shouldOfferHorseChoice(selectableHorses, defaultHorseIds)}
            onCompletePlanned={
              plannedSessionToComplete
                ? () => {
                    toggleCompleted(plannedSessionToComplete.id);
                    setShowForm(false);
                    setEditingId(null);
                    setForm(emptyForm());
                    setShowSessionDetails(false);
                    setSavedNotice({ text: t("Séance planifiée marquée comme faite.") });
                  }
                : null
            }
            showDetails={showSessionDetails}
            onToggleDetails={() => setShowSessionDetails((v) => !v)}
            detailsSummary={sessionDetailsSummary}
            overLimit={sessionOverLimit}
            createCount={sessionCreateCount}
            missingHorseChoice={missingHorseChoice}
            onCancel={() => {
              setShowForm(false);
              setEditingId(null);
              setForm(emptyForm());
              setShowSessionDetails(false);
            }}
            onSubmit={handleSubmit}
          />
        ) : showApptForm ? (
          <AppointmentForm
            show={showApptForm}
            form={apptForm}
            setForm={setApptForm}
            editingApptId={editingApptId}
            reminderUnlocked={reminderUnlocked}
            submitting={submittingAppt}
            selectableHorses={selectableHorses}
            fallbackHorseIds={defaultHorseIds}
            targetHorseName={targetHorse?.name ?? null}
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
            selectableHorses={selectableHorses}
            fallbackHorseIds={defaultHorseIds}
            targetHorseName={targetHorse?.name ?? null}
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
            targetHorseName={targetHorse?.name ?? null}
            onOpen={() => setShowJournalForm(true)}
            onCancel={cancelJournalForm}
            onSubmit={handleSubmitJournalEntry}
            onPickPhoto={handlePickJournalPhoto}
          />
        ) : null}
      </FadeInView>
      </View>

      {!anyFormOpen && unifiedEvents.length > 0 ? (
        <FadeInView delay={90}>
          <PlanningFilter value={filter} onChange={setFilter} />
        </FadeInView>
      ) : null}

      {/* Onglet « Concours » : la checklist type, à régler une fois pour tous
          les concours à venir (cf. ChecklistTemplateCard). */}
      {filter === "concours" && !showForm && !showApptForm && !showExpenseForm && !showJournalForm && unifiedEvents.length > 0 ? (
        <FadeInView delay={100}>
          <ChecklistTemplateCard template={checklistTemplate} onSave={saveChecklistTemplate} />
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
              <AddToggle label={t("Planifier une séance ce jour")} onPress={() => openCreateForm(selectedDay)} color={colors.primary} />
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
                  horseName={eventHorseName(event)}
                />
              </FadeInView>
            ))
          )}
        </>
      ) : (
        <>
          <FadeInView delay={120}>
            <Text className="text-xl font-bold text-text">{t("À venir")}</Text>
          </FadeInView>

          {upcoming.length === 0 ? (
            <FadeInView delay={160}>
              {/* « Rien de planifié » ne veut pas dire « rien à faire » : on
                  dit ce qui existe quand même (le passé déjà enregistré, ou
                  le filtre qui masque le reste) et ce qu'on peut faire d'ici. */}
              <View className={`${CARD} items-center gap-2`}>
                <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
                  <MaterialCommunityIcons name="calendar-blank-outline" size={22} color={colors.textMuted} />
                </View>
                <Text className="text-center text-sm text-muted">
                  {filter === "all"
                    ? done.length > 0
                      ? t("Rien de planifié à venir — {length} événement{v} déjà passé{v2} plus bas.", { length: done.length, v: done.length > 1 ? "s" : "", v2: done.length > 1 ? "s" : "" })
                      : t("Rien de planifié à venir, et rien d'enregistré pour le passé.")
                    : t("Rien de ce type à venir — les autres types sont peut-être masqués par le filtre.")}
                </Text>
                {!showForm && !showApptForm ? (
                  <TouchableOpacity accessibilityRole="button" onPress={() => openCreateForm()} activeOpacity={0.7}>
                    <Text className="text-sm font-semibold text-accent">{t("Planifier une séance")}</Text>
                  </TouchableOpacity>
                ) : null}
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
                      horseName={eventHorseName(event)}
                    />
                  </FadeInView>
                ))}
              </View>
            ))
          )}

          {done.length > 0 ? (
            <>
              <FadeInView delay={220}>
                <TouchableOpacity accessibilityRole="button"
                  onPress={() => setShowPast((v) => !v)}
                  activeOpacity={0.8}
                  className="mt-2 flex-row items-center justify-between"
                >
                  <Text className="text-xl font-bold text-text">{t("Événements passés (")}{done.length})</Text>
                  <MaterialCommunityIcons
                    name={showPast ? "chevron-up" : "chevron-down"}
                    size={22}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </FadeInView>
              {showPast
                ? doneGroups.map((group, gi) => (
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
                            horseName={eventHorseName(event)}
                          />
                        </FadeInView>
                      ))}
                    </View>
                  ))
                : null}
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

export default lazyTab(PlanningScreen);
