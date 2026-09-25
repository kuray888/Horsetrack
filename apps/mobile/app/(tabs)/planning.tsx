import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { FadeInView } from "@/components/FadeInView";
import { CircularProgress } from "@/components/CircularProgress";
import { Screen } from "@/components/Screen";
import { Field } from "@/components/Field";
import { DatePickerField } from "@/components/DatePickerField";
import { TimePickerField } from "@/components/TimePickerField";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { RecurrenceField } from "@/components/RecurrenceField";
import { FormDetails } from "@/components/FormDetails";
import { NEVER_RECURRENCE, computeRecurrenceDates, type Recurrence } from "@/lib/recurrence";
import { PrimaryButton } from "@/components/onboarding";
import { colors as staticColors } from "@/theme/colors";
import { useThemeColors } from "@/theme/ThemeProvider";
import { formatDuration, isSameDate, MONTHS } from "@/lib/dateFormat";
import { useHorses } from "@/horses/store";
import { useSelectableHorses } from "@/horses/useSelectableHorses";
import { HorseSwitcher } from "@/horses/components/HorseSwitcher";
import { HorseFilterChips } from "@/horses/components/HorseFilterChips";
import { HorseMultiSelect } from "@/horses/components/HorseMultiSelect";
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
import { useAgenda, ACTIVITY_META, type ActivityType, type Appointment, type CompetitionEntry, type ExpenseCategory } from "@/agenda/store";
import { suggestedAppointmentFor as findSuggestedAppointment } from "@/agenda/meta";
import { useSessions, type SessionIntensity, type TrainingSession } from "@/sessions/store";
import { findPlannedSessionToComplete } from "@/sessions/plannedDuplicate";
import { SessionDonePrompt, useSessionDonePrompt } from "@/sessions/useSessionDonePrompt";
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
  eventDays,
  eventHorseId,
  isEventUpcoming,
  isNewPlanningDestination,
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
import { ChecklistTemplateCard } from "@/agenda/components/ChecklistTemplateCard";
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

/** Sélection affichée par le sélecteur "Type de séance" — `activityType`
 * (5 valeurs existantes) + la sentinelle `OTHER_OPTION` (même convention que
 * BreedField/CoatField/InjuryHistoryField/goal-modal.tsx pour "Autre /
 * saisie libre"). Décorrélée de `activityType` lui-même : ce dernier garde
 * toujours une valeur technique valide (jamais "Autre"), nécessaire tant que
 * l'enum existant n'est pas étendu — cf. son commentaire sur TrainingSession. */
type SessionTypeSelection = ActivityType | typeof OTHER_OPTION;

type SessionForm = {
  activityType: ActivityType;
  typeSelection: SessionTypeSelection;
  customActivityLabel: string;
  date: Date | null;
  time: string;
  durationMinutes: number;
  intensity: SessionIntensity;
  notes: string;
  recurrence: Recurrence;
  /** Chevaux visés à la création — vide = « aucun choix explicite », donc la
   * cible par défaut de la vue (cf. defaultHorseIds : aucun en vue « Tous »,
   * sinon le cheval ciblé). Ignoré en édition, comme pour les rendez-vous. */
  horseIds: string[];
  /** « Planifier » (faux, défaut) ou « Enregistrer une séance faite » (vrai).
   * Les deux gestes produisent la même TrainingSession — seul `completed`
   * change (cf. addSession) —, mais ce ne sont pas la même intention : noter
   * après coup la séance du matin obligeait sinon à créer la séance puis à
   * la cocher, et rien dans le formulaire ne disait laquelle des deux choses
   * on était en train de faire. Ignoré en édition : la carte de la séance
   * garde son propre « Marquer faite » (cf. SessionCard). */
  completed: boolean;
};

function emptyForm(): SessionForm {
  return {
    activityType: "dressage",
    typeSelection: "dressage",
    customActivityLabel: "",
    date: new Date(),
    time: "",
    durationMinutes: 45,
    intensity: "medium",
    notes: "",
    recurrence: NEVER_RECURRENCE,
    horseIds: [],
    completed: false,
  };
}

function formFromSession(session: TrainingSession): SessionForm {
  return {
    activityType: session.activityType,
    typeSelection: session.customActivityLabel ? OTHER_OPTION : session.activityType,
    customActivityLabel: session.customActivityLabel ?? "",
    date: session.date,
    time: session.time,
    durationMinutes: session.durationMinutes ?? 45,
    intensity: session.intensity ?? "medium",
    notes: session.notes,
    recurrence: NEVER_RECURRENCE,
    horseIds: [],
    completed: session.completed,
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
          <TouchableOpacity onPress={() => onChangeMonth(-1)} hitSlop={8} className="p-1.5" accessibilityRole="button" accessibilityLabel="Mois précédent">
            <MaterialCommunityIcons name="chevron-left" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onChangeMonth(1)} hitSlop={8} className="p-1.5" accessibilityRole="button" accessibilityLabel="Mois suivant">
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
  const [syncedOpenFormKey, setSyncedOpenFormKey] = useState(openFormKey);
  if (openFormKey !== syncedOpenFormKey) {
    setSyncedOpenFormKey(openFormKey);
    if (openFormParam === "session") {
      // « Planifier une séance » vient de l'Accueil ou d'une fiche cheval, donc
      // pour le cheval actif — pas pour toute l'écurie si la vue « Tous »
      // était restée sélectionnée depuis une visite précédente.
      setFilterHorseId(selectedHorse?.id ?? null);
      openCreateForm();
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
        Alert.alert("Pour quel cheval ?", "Choisis au moins un cheval avant d'enregistrer cette séance.");
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
          "Trop de séances d'un coup",
          `Une création est limitée à ${MAX_ENTRIES_PER_SUBMIT} séances (chevaux × répétitions). Réduis la répétition ou le nombre de chevaux.`
        );
        return false;
      }
      // Chevaux AFFICHÉS, et non cible par défaut : en vue « Tous » celle-ci
      // est vide alors que la vue montre toute l'écurie (cf. targetsOutsideView).
      hiddenNames = targetsOutsideView(sessionHorseIds, visibleHorseIds).map(
        (id) => selectableHorses.find((h) => h.id === id)?.name ?? "un autre cheval"
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
        ? "Séance modifiée."
        : createdCount > 1
          ? `${createdCount} séances enregistrées.`
          : form.completed
            ? "Séance enregistrée comme faite."
            : "Séance planifiée.",
    });
    // Une séance créée pour un cheval que la vue n'affiche pas semblerait
    // perdue : on le dit (cf. hiddenTargetsMessage). L'alerte prime sur la
    // confirmation discrète ci-dessus, elle demande un accusé de réception.
    if (hiddenNames.length > 0) Alert.alert("Séance enregistrée", hiddenTargetsMessage(hiddenNames));
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
    Alert.alert("Supprimer cette séance ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => deleteSession(session.id) },
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
    form.time.trim() ? form.time.trim() : "sans heure",
    `intensité ${INTENSITY_META[form.intensity].label.toLowerCase()}`,
    form.notes.trim() ? "avec note" : "sans note",
    !editingId && !form.completed && form.recurrence.mode === "custom" ? "répétée" : null,
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

  return (
    <>
    <Screen>
      <FadeInView>
        <View className="gap-1">
          <Text className="text-3xl font-display tracking-tight text-text">Planning</Text>
          <Text className="text-base text-muted">
            {showingAllHorses
              ? "La vie équestre de toute l'écurie, en un seul endroit"
              : `La vie équestre de ${filterHorse?.name ?? selectedHorse?.name ?? "ton cheval"}, en un seul endroit`}
          </Text>
        </View>
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

      {/* Sélecteur de cheval — même composant que sur Accueil/Agenda (cf.
          audit du 2026-09-16) : sans lui, ce sous-titre était le seul indice
          du cheval concerné, et rien ne permettait de le changer ici. */}
      {horses.length > 1 ? (
        <FadeInView delay={20}>
          <View className="gap-2">
            {/* En vue « Tous », aucun avatar n'est mis en avant (sinon l'anneau
                restait sur le cheval actif pendant que la puce disait « Tous »),
                et toucher un avatar — même le cheval déjà actif — recadre la
                vue sur lui. */}
            <HorseSwitcher hideSelection={showingAllHorses} onSelect={(id) => setFilterHorseId(id)} />
            {/* Filtre d'affichage, distinct du sélecteur ci-dessus : « Tous »
                mêle les chevaux de l'écurie dans une seule liste, chaque
                événement portant alors la pastille de son cheval. Limité aux
                chevaux possédés et non verrouillés (cf.
                horses/selectableHorses.ts). */}
            <HorseFilterChips
              horses={filterChipHorses}
              value={activeFilterId}
              onChange={setFilterHorseId}
              showAll={canShowAllHorses}
            />
            {showingAllHorses ? (
              // Le Journal est volontairement exclu : un souvenir (souvent
              // avec une photo) est propre à un cheval, le dupliquer sur toute
              // l'écurie n'aurait pas de sens.
              <Text className="px-1 text-xs text-muted">
                Séances, rendez-vous et dépenses : tous les chevaux par défaut, à décocher dans le formulaire.
                {targetHorse ? ` Souvenirs du journal : ${targetHorse.name} (cheval actif).` : ""}
              </Text>
            ) : targetHorse ? (
              <Text className="px-1 text-xs text-muted">
                Les nouvelles entrées seront rattachées à {targetHorse.name}
                {filterHorse ? " (cheval du filtre)" : " (cheval actif)"}.
              </Text>
            ) : null}
          </View>
        </FadeInView>
      ) : null}

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
              <Text className="text-sm font-bold uppercase tracking-wide text-on-primary/80">
                Cette semaine{showingAllHorses ? " · toute l'écurie" : ""}
              </Text>
              <Text className="text-[15px] leading-5 text-on-primary">
                {weekDone} séance{weekDone > 1 ? "s" : ""} faite{weekDone > 1 ? "s" : ""} · {formatDuration(weekMinutes)} au
                programme
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
      {showingAllHorses ? null : (
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
      )}

      <FadeInView delay={60}>
        {showForm ? (
          <View className={`${CARD} gap-3`}>
            <Text className="text-sm font-bold uppercase tracking-wide text-accent">
              {editingId ? "Modifier la séance" : form.completed ? "Enregistrer une séance faite" : "Planifier une séance"}
            </Text>
            {/* Planifier ou noter après coup : deux intentions distinctes pour
                un même modèle (cf. SessionForm.completed). En tête du
                formulaire, parce que le choix change ce que les champs
                suivants veulent dire (une date à venir ou un fait passé). */}
            {!editingId ? (
              <Field label="Cette séance est…">
                <ChipSelect
                  options={[
                    { value: "planned", label: "À planifier", icon: { name: "calendar-clock" as const, color: colors.primary } },
                    { value: "done", label: "Déjà faite", icon: { name: "check-circle-outline" as const, color: colors.success } },
                  ]}
                  value={form.completed ? "done" : "planned"}
                  onChange={(v) => setForm((f) => ({ ...f, completed: v === "done" }))}
                />
              </Field>
            ) : null}
            <Field label="Type de séance">
              <ChipSelect
                options={[
                  ...Object.entries(ACTIVITY_META).map(([value, meta]) => ({
                    value: value as SessionTypeSelection,
                    label: meta.label,
                    icon: { name: meta.icon, color: meta.tint },
                  })),
                  { value: OTHER_OPTION, label: "Autre", icon: { name: "shape-outline" as const, color: colors.textMuted } },
                ]}
                value={form.typeSelection}
                onChange={(typeSelection) =>
                  setForm((f) => ({
                    ...f,
                    typeSelection,
                    // Standard → Autre : garde activityType tel quel (fallback
                    // technique, cf. son commentaire sur TrainingSession).
                    // Autre → standard : le type choisi devient activityType et
                    // efface le texte personnalisé.
                    activityType: typeSelection === OTHER_OPTION ? f.activityType : typeSelection,
                    customActivityLabel: typeSelection === OTHER_OPTION ? f.customActivityLabel : "",
                  }))
                }
              />
            </Field>
            {form.typeSelection === OTHER_OPTION ? (
              <Field label="Précisez votre séance">
                <TextInput
                  className={INPUT}
                  placeholder="Ex : Séance à la plage"
                  value={form.customActivityLabel}
                  onChangeText={(customActivityLabel) => setForm((f) => ({ ...f, customActivityLabel }))}
                />
              </Field>
            ) : null}
            <DatePickerField label="Date" value={form.date} onChange={(date) => setForm((f) => ({ ...f, date }))} />
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
            {!editingId && shouldOfferHorseChoice(selectableHorses, defaultHorseIds) ? (
              <HorseMultiSelect
                horses={selectableHorses}
                fallbackIds={defaultHorseIds}
                value={form.horseIds}
                onChange={(horseIds) => setForm((f) => ({ ...f, horseIds }))}
              />
            ) : null}
            {/* Une séance déjà planifiée le même jour pour le même cheval :
                la marquer faite plutôt qu'en créer une seconde, qui ferait
                deux lignes pour une seule sortie (et fausserait les stats).
                Le formulaire reste ouvert si l'utilisateur préfère créer. */}
            {plannedSessionToComplete ? (
              <TouchableOpacity
                onPress={() => {
                  toggleCompleted(plannedSessionToComplete.id);
                  setShowForm(false);
                  setEditingId(null);
                  setForm(emptyForm());
                  setShowSessionDetails(false);
                  setSavedNotice({ text: "Séance planifiée marquée comme faite." });
                }}
                activeOpacity={0.8}
                className="flex-row items-center gap-2 rounded-card border border-dashed border-primary p-3"
              >
                <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.primary} />
                <Text className="flex-1 text-sm text-text">
                  Une séance est déjà prévue ce jour-là —{" "}
                  <Text className="font-semibold text-primary">la marquer comme faite</Text> plutôt que d&apos;en
                  ajouter une deuxième.
                </Text>
              </TouchableOpacity>
            ) : null}
            {/* Détails facultatifs repliés — même composant que le formulaire
                de rendez-vous (cf. components/FormDetails.tsx). */}
            <FormDetails
              open={showSessionDetails}
              onToggle={() => setShowSessionDetails((v) => !v)}
              summary={sessionDetailsSummary}
            >
              <>
                <TimePickerField
                  label="Heure (optionnel)"
                  value={form.time}
                  onChange={(time) => setForm((f) => ({ ...f, time }))}
                />
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
                {/* Répéter n'a de sens que pour une séance à venir (cf.
                    submitSession, qui l'ignore pour une séance déjà faite). */}
                {!editingId && !form.completed ? (
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
              </>
            </FormDetails>
            {sessionOverLimit ? (
              <Text className="text-xs text-danger">
                {`${sessionCreateCount} séances d'un coup, c'est trop (maximum ${MAX_ENTRIES_PER_SUBMIT}). Réduis la répétition ou le nombre de chevaux.`}
              </Text>
            ) : null}
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setForm(emptyForm());
                  setShowSessionDetails(false);
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
                      : sessionCreateCount > 1
                        ? `Ajouter (×${sessionCreateCount})`
                        : form.completed
                          ? "Enregistrer la séance"
                          : "Planifier"
                  }
                  disabled={!form.date || sessionOverLimit || missingHorseChoice}
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
        ) : (
          <AddToggle label="Ajouter" onPress={() => setQuickAddVisible(true)} color={colors.primary} />
        )}
      </FadeInView>

      {!showForm && !showApptForm && !showExpenseForm && !showJournalForm && unifiedEvents.length > 0 ? (
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
                  horseName={eventHorseName(event)}
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
                      ? `Rien de planifié à venir — ${done.length} événement${done.length > 1 ? "s" : ""} déjà passé${done.length > 1 ? "s" : ""} plus bas.`
                      : "Rien de planifié à venir, et rien d'enregistré pour le passé."
                    : "Rien de ce type à venir — les autres types sont peut-être masqués par le filtre."}
                </Text>
                {!showForm && !showApptForm ? (
                  <TouchableOpacity onPress={() => openCreateForm()} activeOpacity={0.7}>
                    <Text className="text-sm font-semibold text-accent">Planifier une séance</Text>
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
                <TouchableOpacity
                  onPress={() => setShowPast((v) => !v)}
                  activeOpacity={0.8}
                  className="mt-2 flex-row items-center justify-between"
                >
                  <Text className="text-xl font-bold text-text">Événements passés ({done.length})</Text>
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
