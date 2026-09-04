import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import type { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import { cancelReminder, type ReminderOption } from "@/lib/notifications";
import { cancelEmailReminder } from "@/lib/emailReminders";
import {
  pushDocument,
  deleteDocumentRemote,
  pushAppointment,
  deleteAppointmentRemote,
  pushJournalEntry,
  deleteJournalEntryRemote,
  pushCompetitionEntry,
  deleteCompetitionEntryRemote,
  pushExpense,
  deleteExpenseRemote,
} from "@/lib/cloudSync";
import { safeJsonParse } from "@/lib/safeJsonParse";
import { useHorses } from "@/horses/store";
import type { Discipline } from "@/onboarding/store";

/**
 * Rendez-vous et documents, persistés localement (en attendant Supabase) —
 * accessible depuis tout l'app (pas seulement l'écran Agenda) pour que Today
 * puisse afficher les vrais prochains rendez-vous dans "À venir" plutôt que
 * des données factices déconnectées.
 */

export type AppointmentType =
  | "veto"
  | "osteo"
  | "marechal"
  | "dentiste"
  | "vaccination"
  | "vermifuge"
  | "traitement"
  | "concours"
  | "autre";
export type DocumentCategory = "facture" | "rapport" | "ordonnance" | "autre";
export type ActivityType = "dressage" | "cso" | "balade" | "longe" | "repos";
export type ExpenseCategory =
  | "veto"
  | "marechal"
  | "dentiste"
  | "osteo"
  | "concours"
  | "pension"
  | "alimentation"
  | "complements"
  | "materiel"
  | "transport"
  | "coaching"
  | "autre";

export type ChecklistItem = { id: string; label: string; checked: boolean };

/** Épreuve d'un concours — N par rendez-vous de type "concours" (cf.
 * CompetitionEntry côté schema.prisma). Table dédiée côté serveur plutôt
 * qu'un champ JSON comme ChecklistItem : plus riche par ligne et destinée à
 * grandir en nombre. */
export type CompetitionEntry = {
  id: string;
  name: string;
  discipline: Discipline;
  time: string;
  /** Résultat saisi après l'épreuve. Null tant que pas encore renseigné. */
  result: string | null;
};

/** Libellés/icônes d'affichage pour ActivityType — utilisé par le journal
 * (cf. (tabs)/agenda.tsx) et par la planification manuelle de séances (cf.
 * sessions/store.tsx, (tabs)/today.tsx, (tabs)/planning.tsx), donc défini ici
 * plutôt que dupliqué dans chaque écran consommateur. */
export const ACTIVITY_META: Record<
  ActivityType,
  { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; tint: string; chip: string; tag: string }
> = {
  dressage: { label: "Dressage", icon: "horse-variant", tint: colors.primary, chip: "bg-primary/15", tag: "text-primary" },
  cso: { label: "CSO", icon: "flag-checkered", tint: colors.accent, chip: "bg-accent/15", tag: "text-accent" },
  balade: { label: "Balade", icon: "walk", tint: colors.success, chip: "bg-success/15", tag: "text-success" },
  longe: { label: "Longe", icon: "sync", tint: colors.warning, chip: "bg-warning/15", tag: "text-warning" },
  repos: { label: "Repos", icon: "sleep", tint: colors.textMuted, chip: "bg-border", tag: "text-muted" },
};

/** Anciennement défini dans progress/store.tsx (système de badges/XP, retiré
 * avec la génération de programme par IA) — relocalisé ici car c'est en
 * réalité un concept de journal, pas de progression IA. */
export type Mood = "great" | "good" | "okay" | "hard";

export type WeatherSnapshot = { tempC: number; code: number; label: string; icon: string };

export type Appointment = {
  id: string;
  /** Cheval auquel ce rendez-vous est rattaché — pilote le partage (cf.
   * lib/sharing.ts, RLS can_access_horse) : un collaborateur DP/coach ne voit
   * que les rendez-vous du cheval partagé avec lui. Null seulement pour des
   * entrées créées avant l'introduction de ce champ, en attendant le
   * rattachement automatique au chargement (cf. AgendaProvider ci-dessous) —
   * une entrée sans horseId n'est jamais synchronisée (cf. lib/cloudSync.ts). */
  horseId: string | null;
  type: AppointmentType;
  title: string;
  date: Date;
  time: string;
  location: string;
  notes: string;
  reminder: ReminderOption;
  /** Id de la notification locale programmée, pour pouvoir l'annuler. Null si pas de rappel programmé. */
  reminderNotificationId: string | null;
  /** Id du rappel email programmé côté serveur, pour pouvoir l'annuler. Null si pas de rappel email (Free, ou "Aucun"). */
  emailReminderId: string | null;
  /** Résultat saisi après l'épreuve (concours uniquement). Null si pas encore renseigné. */
  result: string | null;
  /** Checklist de préparation (concours uniquement). Vide pour les autres types. */
  checklist: ChecklistItem[];
  /** Numéro de dossard (concours uniquement) — un dossard par cheval par
   * concours, pas par épreuve. Null pour les autres types. */
  dossard: string | null;
  /** Épreuves du concours (concours uniquement). Vide pour les autres types. */
  competitionEntries: CompetitionEntry[];
  /** Praticien/professionnel intervenu (surtout pertinent pour les types de
   * soin) — texte libre, null si non renseigné. */
  professional: string | null;
  /** Coût de ce soin, informatif — distinct d'une Expense liée (cf.
   * Expense.appointmentId), qui reste le rattachement optionnel côté budget. */
  cost: number | null;
  /** Prochaine échéance du même soin (ex: prochain rappel de vaccin) — pilote
   * un rappel local si renseignée (cf. (tabs)/agenda.tsx). Null si aucune
   * échéance de suivi. */
  nextDueDate: Date | null;
  /** Id de la notification locale programmée pour nextDueDate, pour pouvoir
   * l'annuler — même principe que reminderNotificationId, jamais synchronisé. */
  nextDueNotificationId: string | null;
};

/** `horseId` n'est pas fourni par l'appelant : `addAppointment` le rattache
 * automatiquement au cheval actuellement sélectionné (cf. AgendaProvider). */
export type NewAppointment = Omit<
  Appointment,
  "id" | "horseId" | "result" | "checklist" | "competitionEntries"
> & {
  checklist?: ChecklistItem[];
  competitionEntries?: CompetitionEntry[];
};

export type Doc = {
  id: string;
  /** Cheval concerné — même rôle que Appointment.horseId (rattaché au cheval
   * sélectionné à la création, cf. addDocument), mais le partage n'en dépend
   * jamais : le coffre-fort reste privé par cavalier (cf. rls.sql, jamais
   * can_access_horse), horseId ne sert ici qu'à filtrer l'affichage par
   * cheval dans une écurie à plusieurs chevaux. Null pour les documents créés
   * avant l'introduction de ce champ (cf. backfill au chargement). */
  horseId: string | null;
  category: DocumentCategory;
  name: string;
  date: Date;
  /** URI de la photo du document : chemin local (copié dans le stockage
   * persistant de l'app via lib/imagePicker.ts, comme les photos de cheval)
   * tant qu'elle n'a pas encore été synchronisée, puis URL signée Supabase
   * une fois restaurée depuis le cloud (cf. lib/cloudSync.ts pullDocuments).
   * Null tant qu'aucune photo n'a été ajoutée. */
  fileUri: string | null;
  /** Chemin dans le bucket Storage "documents" une fois synchronisé — permet
   * de ne pas re-uploader la même photo à chaque synchro. Null tant que pas
   * encore synchronisé (ou pas de photo). */
  filePath: string | null;
};

/**
 * Entrée de journal de travail libre — indépendante du programme 8 semaines
 * généré (cf. program/store.tsx) : juste un constat de ce qui a été fait
 * aujourd'hui, sans lien avec une séance planifiée. Pas de rappel (saisie
 * rétroactive, jamais future).
 */
export type JournalEntry = {
  id: string;
  /** Même rôle que Appointment.horseId — voir son commentaire. */
  horseId: string | null;
  date: Date;
  time: string;
  activityType: ActivityType;
  mood: Mood;
  notes: string;
  /** Météo au moment de la saisie (best-effort, cf. lib/weather.ts) — null si position/permission indisponible. */
  weather: WeatherSnapshot | null;
};

/**
 * Dépense liée à un cheval — même logique de rattachement/partage que
 * Appointment/JournalEntry (horseId, can_access_horse), pas privée par
 * cavalier comme Doc : le suivi de coûts en demi-pension exige que le
 * collaborateur la voie aussi.
 */
export type Expense = {
  id: string;
  /** Même rôle que Appointment.horseId — voir son commentaire. */
  horseId: string | null;
  amount: number;
  /** Toujours "EUR" pour l'instant — pas de sélecteur de devise côté UI. */
  currency: string;
  category: ExpenseCategory;
  date: Date;
  notes: string;
  /** Rattachement optionnel à un rendez-vous existant (suggéré, jamais créé
   * automatiquement — cf. (tabs)/agenda.tsx). Null si non rattachée. */
  appointmentId: string | null;
  /** Rattachement optionnel à un reçu du coffre-fort. Résolu localement
   * contre la liste `documents` déjà chargée (cf. cloudSync.ts pullExpenses)
   * — un collaborateur verra "reçu non disponible" si le document appartient
   * au propriétaire, RLS documents n'étant jamais partagée. */
  documentId: string | null;
  /** Statut payé/à régler — fonctionnalité Premium (cf. <Locked> dans
   * (tabs)/agenda.tsx) ; reste toujours `false` sur un compte gratuit,
   * faute de pouvoir basculer le statut. */
  isPaid: boolean;
};

export type NewExpense = Omit<Expense, "id" | "horseId">;

const APPOINTMENTS_KEY = "agenda_appointments_v1";
const DOCUMENTS_KEY = "agenda_documents_v1";
const JOURNAL_KEY = "agenda_journal_v1";
const EXPENSES_KEY = "agenda_expenses_v1";

// Suffixe aléatoire en plus du timestamp : deux ajouts dans la même
// milliseconde (double-tap sur "Ajouter") ne doivent jamais produire le même
// id, sinon `deleteAppointment`/`toggleChecklistItem` agiraient sur les deux
// entrées à la fois.
function generateId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function daysFromNow(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

const CHECKLIST_LABELS = [
  "Papiers d'identité du cheval (passeport)",
  "Carnet de vaccination à jour",
  "Licence FFE / engagement",
  "Matériel de pansage",
  "Tapis de selle + couvertures",
  "Protections (guêtres, cloches)",
  "Casque",
  "Gilet de protection",
  "Eau et nourriture pour la journée",
];

export function defaultChecklist(): ChecklistItem[] {
  return CHECKLIST_LABELS.map((label, i) => ({ id: `c${i}`, label, checked: false }));
}

/** Aucune donnée de démonstration : un compte neuf doit voir un agenda
 * réellement vide, pas des rendez-vous/factures fictifs indiscernables de
 * vraies entrées (cf. audit produit du 2026-09-03). */
const DEFAULT_APPOINTMENTS: Appointment[] = [];

const DEFAULT_DOCUMENTS: Doc[] = [];

const DEFAULT_JOURNAL: JournalEntry[] = [];

const DEFAULT_EXPENSES: Expense[] = [];

type AgendaContextValue = {
  appointments: Appointment[];
  documents: Doc[];
  journal: JournalEntry[];
  expenses: Expense[];
  addAppointment: (appt: NewAppointment) => void;
  updateAppointment: (
    apptId: string,
    patch: Partial<Omit<Appointment, "id" | "horseId" | "checklist" | "competitionEntries">>
  ) => void;
  deleteAppointment: (appt: Appointment) => void;
  saveResult: (apptId: string, result: string) => void;
  toggleChecklistItem: (apptId: string, itemId: string) => void;
  addChecklistItem: (apptId: string, label: string) => void;
  removeChecklistItem: (apptId: string, itemId: string) => void;
  addCompetitionEntry: (apptId: string, entry: Omit<CompetitionEntry, "id" | "result">) => void;
  updateCompetitionEntryResult: (apptId: string, entryId: string, result: string) => void;
  deleteCompetitionEntry: (apptId: string, entryId: string) => void;
  /** Retourne l'id généré localement — cf. addDocument dans le provider. */
  addDocument: (doc: Omit<Doc, "id" | "filePath" | "horseId">) => string;
  updateDocument: (docId: string, patch: Partial<Omit<Doc, "id" | "filePath">>) => void;
  deleteDocument: (docId: string) => void;
  /** Remplace les documents locaux par ceux restaurés depuis le cloud (cf.
   * (auth)/login.tsx) — n'écrit que l'état + SecureStore, ne relance jamais
   * de synchro (on viendrait de recevoir exactement ces données du serveur). */
  hydrateDocumentsFromCloud: (docs: Doc[]) => void;
  hydrateAppointmentsFromCloud: (appts: Appointment[]) => void;
  hydrateJournalFromCloud: (entries: JournalEntry[]) => void;
  /** `horseId` optionnel : sinon, rattaché au cheval globalement sélectionné
   * (cf. implémentation dans le provider) — permet à un appelant qui connaît
   * déjà le bon cheval (ex: Journal global filtré) de l'imposer explicitement. */
  addJournalEntry: (entry: Omit<JournalEntry, "id" | "horseId"> & { horseId?: string | null }) => void;
  updateJournalEntry: (entryId: string, patch: Partial<Omit<JournalEntry, "id" | "horseId">>) => void;
  deleteJournalEntry: (entryId: string) => void;
  addExpense: (expense: NewExpense) => void;
  updateExpense: (expenseId: string, patch: Partial<Omit<Expense, "id" | "horseId" | "isPaid" | "documentId">>) => void;
  deleteExpense: (expenseId: string) => void;
  toggleExpensePaid: (expenseId: string) => void;
  linkExpenseDocument: (expenseId: string, documentId: string | null) => void;
  hydrateExpensesFromCloud: (expenses: Expense[]) => void;
  /** Efface rendez-vous + documents + journal + dépenses locaux (cf. suppression de compte dans Profil). */
  clearAll: () => Promise<void>;
};

const AgendaContext = createContext<AgendaContextValue | null>(null);

export function AgendaProvider({ children }: { children: ReactNode }) {
  const { horses, selectedHorse, loading: horsesLoading } = useHorses();
  const [appointments, setAppointments] = useState<Appointment[]>(DEFAULT_APPOINTMENTS);
  const [documents, setDocuments] = useState<Doc[]>(DEFAULT_DOCUMENTS);
  const [journal, setJournal] = useState<JournalEntry[]>(DEFAULT_JOURNAL);
  const [expenses, setExpenses] = useState<Expense[]>(DEFAULT_EXPENSES);
  const [loaded, setLoaded] = useState(false);

  // Charge les données persistées une fois au montage (sinon on garde les mocks par défaut).
  useEffect(() => {
    (async () => {
      try {
        const [apptRaw, docRaw, journalRaw, expenseRaw] = await Promise.all([
          SecureStore.getItemAsync(APPOINTMENTS_KEY),
          SecureStore.getItemAsync(DOCUMENTS_KEY),
          SecureStore.getItemAsync(JOURNAL_KEY),
          SecureStore.getItemAsync(EXPENSES_KEY),
        ]);
        const parsedAppts = safeJsonParse<Appointment[] | null>(apptRaw, null);
        if (parsedAppts) {
          setAppointments(
            parsedAppts.map((a) => ({
              ...a,
              date: new Date(a.date),
              horseId: a.horseId ?? null,
              emailReminderId: a.emailReminderId ?? null,
              result: a.result ?? null,
              checklist: a.checklist ?? (a.type === "concours" ? defaultChecklist() : []),
              dossard: a.dossard ?? null,
              competitionEntries: a.competitionEntries ?? [],
              professional: a.professional ?? null,
              cost: a.cost ?? null,
              nextDueDate: a.nextDueDate ? new Date(a.nextDueDate) : null,
              nextDueNotificationId: a.nextDueNotificationId ?? null,
            }))
          );
        }
        const parsedDocs = safeJsonParse<Doc[] | null>(docRaw, null);
        if (parsedDocs) {
          // fileUri/filePath n'existent pas sur les documents sauvegardés avant
          // leur ajout — les compléter plutôt que de laisser `undefined` (cf. le
          // même souci déjà rencontré sur Horse.restDayActivities).
          setDocuments(
            parsedDocs.map((d) => ({
              ...d,
              date: new Date(d.date),
              fileUri: d.fileUri ?? null,
              filePath: d.filePath ?? null,
              horseId: d.horseId ?? null,
            }))
          );
        }
        const parsedJournal = safeJsonParse<JournalEntry[] | null>(journalRaw, null);
        if (parsedJournal) {
          setJournal(
            parsedJournal.map((j) => ({ ...j, date: new Date(j.date), horseId: j.horseId ?? null, weather: j.weather ?? null }))
          );
        }
        const parsedExpenses = safeJsonParse<Expense[] | null>(expenseRaw, null);
        if (parsedExpenses) {
          setExpenses(
            parsedExpenses.map((e) => ({
              ...e,
              date: new Date(e.date),
              horseId: e.horseId ?? null,
              appointmentId: e.appointmentId ?? null,
              documentId: e.documentId ?? null,
              isPaid: e.isPaid ?? false,
            }))
          );
        }
      } catch (e) {
        console.warn("[agenda] lecture SecureStore échouée, agenda par défaut", e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Rattache au cheval sélectionné/primaire les rendez-vous/entrées de
  // journal/dépenses/documents créés avant l'introduction de horseId (cf. son
  // commentaire sur Appointment, et sur Doc pour les documents — introduit
  // plus tard, seul le coffre-fort avait jusqu'ici des entrées non rattachées
  // en nombre) — attend que l'écurie ait fini de charger pour ne pas
  // rattacher par erreur au cheval de démo par défaut le temps du chargement.
  useEffect(() => {
    if (!loaded || horsesLoading) return;
    const fallbackHorseId = selectedHorse?.id ?? horses.find((h) => h.isPrimary)?.id ?? horses[0]?.id ?? null;
    if (!fallbackHorseId) return;
    setAppointments((list) => (list.every((a) => a.horseId) ? list : list.map((a) => (a.horseId ? a : { ...a, horseId: fallbackHorseId }))));
    setJournal((list) => (list.every((j) => j.horseId) ? list : list.map((j) => (j.horseId ? j : { ...j, horseId: fallbackHorseId }))));
    setExpenses((list) => (list.every((e) => e.horseId) ? list : list.map((e) => (e.horseId ? e : { ...e, horseId: fallbackHorseId }))));
    setDocuments((list) => (list.every((d) => d.horseId) ? list : list.map((d) => (d.horseId ? d : { ...d, horseId: fallbackHorseId }))));
  }, [loaded, horsesLoading, horses, selectedHorse]);

  // Persiste à chaque changement, une fois le chargement initial terminé
  // (sinon on écraserait les données sauvegardées avec les mocks par défaut).
  useEffect(() => {
    if (!loaded) return;
    SecureStore.setItemAsync(APPOINTMENTS_KEY, JSON.stringify(appointments));
  }, [appointments, loaded]);

  useEffect(() => {
    if (!loaded) return;
    SecureStore.setItemAsync(DOCUMENTS_KEY, JSON.stringify(documents));
  }, [documents, loaded]);

  useEffect(() => {
    if (!loaded) return;
    SecureStore.setItemAsync(JOURNAL_KEY, JSON.stringify(journal));
  }, [journal, loaded]);

  useEffect(() => {
    if (!loaded) return;
    SecureStore.setItemAsync(EXPENSES_KEY, JSON.stringify(expenses));
  }, [expenses, loaded]);

  const addAppointment = useCallback(
    (appt: NewAppointment) => {
      const next: Appointment = {
        ...appt,
        id: generateId("a"),
        horseId: selectedHorse?.id ?? null,
        result: null,
        checklist: appt.checklist ?? [],
        competitionEntries: appt.competitionEntries ?? [],
      };
      setAppointments((list) => [...list, next]);
      pushAppointment(next).catch(() => {});
      // Épreuves saisies dans le sous-formulaire à la création (cf.
      // agenda.tsx) : chacune vit dans sa propre table côté serveur
      // (contrairement à checklist, sérialisée dans la ligne appointment),
      // donc un push par épreuve après la création du rendez-vous parent.
      for (const entry of next.competitionEntries) {
        pushCompetitionEntry(next.id, entry).catch(() => {});
      }
    },
    [selectedHorse]
  );

  /** Édition des champs de base d'un rendez-vous (type/titre/date/heure/lieu/
   * rappel/dossard) — contrairement à saveResult/toggleChecklistItem etc.
   * (mutateurs dédiés à un sous-champ précis), celui-ci couvre tout ce que le
   * formulaire d'ajout permet déjà de saisir, pour permettre une vraie
   * édition sans passer par supprimer + recréer. Le rappel programmé
   * (reminderNotificationId/emailReminderId) n'est PAS recalculé ici : cf.
   * (tabs)/agenda.tsx handleUpdateAppointment, qui annule l'ancien et
   * reprogramme le nouveau avant d'appeler ce mutateur, exactement comme à la
   * création (cf. handleAddAppointment) — cette fonction reste un simple
   * "patch + push", sans effet de bord sur les notifications. */
  const updateAppointment = useCallback(
    (apptId: string, patch: Partial<Omit<Appointment, "id" | "horseId" | "checklist" | "competitionEntries">>) => {
      const target = appointments.find((a) => a.id === apptId);
      if (!target) return;
      const next = { ...target, ...patch };
      setAppointments((list) => list.map((a) => (a.id === apptId ? next : a)));
      pushAppointment(next).catch(() => {});
    },
    [appointments]
  );

  const deleteAppointment = useCallback((appt: Appointment) => {
    cancelReminder(appt.reminderNotificationId);
    cancelEmailReminder(appt.emailReminderId);
    cancelReminder(appt.nextDueNotificationId);
    setAppointments((list) => list.filter((a) => a.id !== appt.id));
    deleteAppointmentRemote(appt.id).catch(() => {});
  }, []);

  // Les 4 mutateurs ci-dessous calculent le rendez-vous mis à jour à partir de
  // `appointments` (donc en dépendance) plutôt que via la forme fonctionnelle
  // de setState, pour pouvoir le repousser vers le cloud (cf. pushAppointment)
  // — sans ça, un résultat de concours ou une checklist cochée ne survivrait
  // ni à une restauration cloud (cf. login.tsx, qui écraserait silencieusement
  // ces changements jamais envoyés au serveur) ni au partage DP/coach.

  const saveResult = useCallback(
    (apptId: string, result: string) => {
      const target = appointments.find((a) => a.id === apptId);
      if (!target) return;
      const next = { ...target, result };
      setAppointments((list) => list.map((a) => (a.id === apptId ? next : a)));
      pushAppointment(next).catch(() => {});
    },
    [appointments]
  );

  const toggleChecklistItem = useCallback(
    (apptId: string, itemId: string) => {
      const target = appointments.find((a) => a.id === apptId);
      if (!target) return;
      const next = {
        ...target,
        checklist: target.checklist.map((c) => (c.id === itemId ? { ...c, checked: !c.checked } : c)),
      };
      setAppointments((list) => list.map((a) => (a.id === apptId ? next : a)));
      pushAppointment(next).catch(() => {});
    },
    [appointments]
  );

  const addChecklistItem = useCallback(
    (apptId: string, label: string) => {
      const target = appointments.find((a) => a.id === apptId);
      if (!target) return;
      const next = { ...target, checklist: [...target.checklist, { id: generateId("c"), label, checked: false }] };
      setAppointments((list) => list.map((a) => (a.id === apptId ? next : a)));
      pushAppointment(next).catch(() => {});
    },
    [appointments]
  );

  const removeChecklistItem = useCallback(
    (apptId: string, itemId: string) => {
      const target = appointments.find((a) => a.id === apptId);
      if (!target) return;
      const next = { ...target, checklist: target.checklist.filter((c) => c.id !== itemId) };
      setAppointments((list) => list.map((a) => (a.id === apptId ? next : a)));
      pushAppointment(next).catch(() => {});
    },
    [appointments]
  );

  // Épreuves de concours : contrairement à la checklist ci-dessus, chaque
  // épreuve est une ligne dans sa propre table côté serveur (cf.
  // CompetitionEntry, schema.prisma) — on pousse donc l'épreuve modifiée
  // individuellement (pushCompetitionEntry), jamais tout le rendez-vous.
  const addCompetitionEntry = useCallback(
    (apptId: string, entry: Omit<CompetitionEntry, "id" | "result">) => {
      const target = appointments.find((a) => a.id === apptId);
      if (!target) return;
      const newEntry: CompetitionEntry = { ...entry, id: generateId("ce"), result: null };
      const next = { ...target, competitionEntries: [...target.competitionEntries, newEntry] };
      setAppointments((list) => list.map((a) => (a.id === apptId ? next : a)));
      pushCompetitionEntry(apptId, newEntry).catch(() => {});
    },
    [appointments]
  );

  const updateCompetitionEntryResult = useCallback(
    (apptId: string, entryId: string, result: string) => {
      const target = appointments.find((a) => a.id === apptId);
      if (!target) return;
      const updated = target.competitionEntries.find((e) => e.id === entryId);
      if (!updated) return;
      const nextEntry = { ...updated, result };
      const next = {
        ...target,
        competitionEntries: target.competitionEntries.map((e) => (e.id === entryId ? nextEntry : e)),
      };
      setAppointments((list) => list.map((a) => (a.id === apptId ? next : a)));
      pushCompetitionEntry(apptId, nextEntry).catch(() => {});
    },
    [appointments]
  );

  const deleteCompetitionEntry = useCallback(
    (apptId: string, entryId: string) => {
      const target = appointments.find((a) => a.id === apptId);
      if (!target) return;
      const next = { ...target, competitionEntries: target.competitionEntries.filter((e) => e.id !== entryId) };
      setAppointments((list) => list.map((a) => (a.id === apptId ? next : a)));
      deleteCompetitionEntryRemote(entryId).catch(() => {});
    },
    [appointments]
  );

  const addDocument = useCallback(
    (doc: Omit<Doc, "id" | "filePath" | "horseId">) => {
      const id = generateId("d");
      const next: Doc = { ...doc, id, filePath: null, horseId: selectedHorse?.id ?? null };
      setDocuments((list) => [...list, next]);
      // Best-effort, jamais bloquant : cf. lib/cloudSync.ts. Le filePath
      // résultant est reporté localement pour ne pas re-uploader la même photo
      // à la prochaine synchro (cf. pushDocument).
      pushDocument(next)
        .then((filePath) => {
          if (filePath) {
            setDocuments((list) => list.map((d) => (d.id === id ? { ...d, filePath } : d)));
          }
        })
        .catch(() => {});
      // Retourné pour permettre de lier immédiatement le document tout juste
      // créé (ex : reçu joint depuis le formulaire de dépense, cf.
      // (tabs)/agenda.tsx handleAddExpense) sans attendre un aller-retour cloud.
      return id;
    },
    [selectedHorse]
  );

  /** Édition d'un document existant (catégorie/nom/date/photo) — contrairement
   * à addDocument, ne retourne rien : la photo remplacée est réenvoyée par
   * pushDocument (cf. son commentaire) et son filePath reporté localement une
   * fois la synchro terminée, exactement comme à la création. */
  const updateDocument = useCallback(
    (docId: string, patch: Partial<Omit<Doc, "id" | "filePath">>) => {
      const target = documents.find((d) => d.id === docId);
      if (!target) return;
      const next = { ...target, ...patch };
      setDocuments((list) => list.map((d) => (d.id === docId ? next : d)));
      pushDocument(next)
        .then((filePath) => {
          if (filePath && filePath !== next.filePath) {
            setDocuments((list) => list.map((d) => (d.id === docId ? { ...d, filePath } : d)));
          }
        })
        .catch(() => {});
    },
    [documents]
  );

  const deleteDocument = useCallback((docId: string) => {
    setDocuments((list) => list.filter((d) => d.id !== docId));
    deleteDocumentRemote(docId).catch(() => {});
  }, []);

  const hydrateDocumentsFromCloud = useCallback((docs: Doc[]) => {
    setDocuments(docs);
    SecureStore.setItemAsync(DOCUMENTS_KEY, JSON.stringify(docs));
  }, []);

  const hydrateAppointmentsFromCloud = useCallback((appts: Appointment[]) => {
    setAppointments(appts);
    SecureStore.setItemAsync(APPOINTMENTS_KEY, JSON.stringify(appts));
  }, []);

  const hydrateJournalFromCloud = useCallback((entries: JournalEntry[]) => {
    setJournal(entries);
    SecureStore.setItemAsync(JOURNAL_KEY, JSON.stringify(entries));
  }, []);

  const addJournalEntry = useCallback(
    // `horseId` optionnel : par défaut le cheval globalement sélectionné,
    // comme avant — un appelant peut l'imposer explicitement (cf. Journal
    // global filtré sur un cheval précis, (tabs)/journal.tsx) sans qu'il y
    // ait deux sources de vérité : c'est toujours soit un choix explicite de
    // l'appelant, soit le même fallback qu'avant.
    (entry: Omit<JournalEntry, "id" | "horseId"> & { horseId?: string | null }) => {
      const { horseId: explicitHorseId, ...rest } = entry;
      const horseId = explicitHorseId !== undefined ? explicitHorseId : (selectedHorse?.id ?? null);
      const next: JournalEntry = { ...rest, id: generateId("j"), horseId };
      setJournal((list) => [...list, next]);
      pushJournalEntry(next).catch(() => {});
    },
    [selectedHorse]
  );

  /** Édition d'une entrée de journal existante (activité/ressenti/date/heure/
   * notes) — la météo capturée à la création n'est jamais recalculée ici,
   * cf. (tabs)/agenda.tsx : corriger une entrée passée ne doit pas réécrire
   * un relevé météo qui n'a plus de sens rétroactivement. */
  const updateJournalEntry = useCallback(
    (entryId: string, patch: Partial<Omit<JournalEntry, "id" | "horseId">>) => {
      const target = journal.find((j) => j.id === entryId);
      if (!target) return;
      const next = { ...target, ...patch };
      setJournal((list) => list.map((j) => (j.id === entryId ? next : j)));
      pushJournalEntry(next).catch(() => {});
    },
    [journal]
  );

  const deleteJournalEntry = useCallback((entryId: string) => {
    setJournal((list) => list.filter((j) => j.id !== entryId));
    deleteJournalEntryRemote(entryId).catch(() => {});
  }, []);

  const addExpense = useCallback(
    (expense: NewExpense) => {
      const next: Expense = { ...expense, id: generateId("e"), horseId: selectedHorse?.id ?? null };
      setExpenses((list) => [...list, next]);
      pushExpense(next).catch(() => {});
    },
    [selectedHorse]
  );

  /** Édition d'une dépense existante (montant/catégorie/date/notes/rendez-vous
   * lié) — même style fonctionnel que toggleExpensePaid/linkExpenseDocument
   * ci-dessous, pas de dépendance à `expenses`. Ne touche jamais isPaid ni
   * documentId : ces deux champs ont déjà leurs propres mutateurs dédiés. */
  const updateExpense = useCallback(
    (expenseId: string, patch: Partial<Omit<Expense, "id" | "horseId" | "isPaid" | "documentId">>) => {
      setExpenses((list) => {
        const next = list.map((e) => (e.id === expenseId ? { ...e, ...patch } : e));
        const updated = next.find((e) => e.id === expenseId);
        if (updated) pushExpense(updated).catch(() => {});
        return next;
      });
    },
    []
  );

  const deleteExpense = useCallback((expenseId: string) => {
    setExpenses((list) => list.filter((e) => e.id !== expenseId));
    deleteExpenseRemote(expenseId).catch(() => {});
  }, []);

  const toggleExpensePaid = useCallback((expenseId: string) => {
    setExpenses((list) => {
      const next = list.map((e) => (e.id === expenseId ? { ...e, isPaid: !e.isPaid } : e));
      const updated = next.find((e) => e.id === expenseId);
      if (updated) pushExpense(updated).catch(() => {});
      return next;
    });
  }, []);

  /** Lie (ou délie, avec `documentId: null`) un reçu du coffre-fort à une
   * dépense existante — cf. bouton "Joindre une facture" côté agenda.tsx. */
  const linkExpenseDocument = useCallback((expenseId: string, documentId: string | null) => {
    setExpenses((list) => {
      const next = list.map((e) => (e.id === expenseId ? { ...e, documentId } : e));
      const updated = next.find((e) => e.id === expenseId);
      if (updated) pushExpense(updated).catch(() => {});
      return next;
    });
  }, []);

  const hydrateExpensesFromCloud = useCallback((next: Expense[]) => {
    setExpenses(next);
    SecureStore.setItemAsync(EXPENSES_KEY, JSON.stringify(next));
  }, []);

  const clearAll = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(APPOINTMENTS_KEY),
      SecureStore.deleteItemAsync(DOCUMENTS_KEY),
      SecureStore.deleteItemAsync(JOURNAL_KEY),
      SecureStore.deleteItemAsync(EXPENSES_KEY),
    ]);
    setAppointments(DEFAULT_APPOINTMENTS);
    setDocuments(DEFAULT_DOCUMENTS);
    setJournal(DEFAULT_JOURNAL);
    setExpenses(DEFAULT_EXPENSES);
  }, []);

  const value = useMemo<AgendaContextValue>(
    () => ({
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
      hydrateDocumentsFromCloud,
      hydrateAppointmentsFromCloud,
      hydrateJournalFromCloud,
      addJournalEntry,
      updateJournalEntry,
      deleteJournalEntry,
      addExpense,
      updateExpense,
      deleteExpense,
      toggleExpensePaid,
      linkExpenseDocument,
      hydrateExpensesFromCloud,
      clearAll,
    }),
    [
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
      hydrateDocumentsFromCloud,
      hydrateAppointmentsFromCloud,
      hydrateJournalFromCloud,
      addJournalEntry,
      updateJournalEntry,
      deleteJournalEntry,
      addExpense,
      updateExpense,
      deleteExpense,
      toggleExpensePaid,
      linkExpenseDocument,
      hydrateExpensesFromCloud,
      clearAll,
    ]
  );

  return <AgendaContext.Provider value={value}>{children}</AgendaContext.Provider>;
}

export function useAgenda() {
  const ctx = useContext(AgendaContext);
  if (!ctx) throw new Error("useAgenda doit être utilisé dans <AgendaProvider>");
  return ctx;
}
