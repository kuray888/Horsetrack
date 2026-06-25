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
import { cancelReminder, type ReminderOption } from "@/lib/notifications";
import { cancelEmailReminder } from "@/lib/emailReminders";
import {
  pushDocument,
  deleteDocumentRemote,
  pushAppointment,
  deleteAppointmentRemote,
  pushJournalEntry,
  deleteJournalEntryRemote,
} from "@/lib/cloudSync";
import { safeJsonParse } from "@/lib/safeJsonParse";
import type { Mood } from "@/progress/store";
import { useHorses } from "@/horses/store";

/**
 * Rendez-vous et documents, persistés localement (en attendant Supabase) —
 * accessible depuis tout l'app (pas seulement l'écran Agenda) pour que Today
 * puisse afficher les vrais prochains rendez-vous dans "À venir" plutôt que
 * des données factices déconnectées.
 */

export type AppointmentType = "veto" | "osteo" | "marechal" | "dentiste" | "concours" | "autre";
export type DocumentCategory = "facture" | "rapport" | "ordonnance" | "autre";
export type ActivityType = "dressage" | "cso" | "balade" | "longe" | "repos";

export type ChecklistItem = { id: string; label: string; checked: boolean };

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
};

/** `horseId` n'est pas fourni par l'appelant : `addAppointment` le rattache
 * automatiquement au cheval actuellement sélectionné (cf. AgendaProvider). */
export type NewAppointment = Omit<Appointment, "id" | "horseId" | "result" | "checklist"> & {
  checklist?: ChecklistItem[];
};

export type Doc = {
  id: string;
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

const APPOINTMENTS_KEY = "agenda_appointments_v1";
const DOCUMENTS_KEY = "agenda_documents_v1";
const JOURNAL_KEY = "agenda_journal_v1";

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

const DEFAULT_APPOINTMENTS: Appointment[] = [
  {
    id: "a1",
    horseId: null,
    type: "veto",
    title: "Vaccin annuel",
    date: daysFromNow(-32),
    time: "10h00",
    location: "Clinique équine du Val",
    notes: "Rappel grippe + tétanos",
    reminder: "none",
    reminderNotificationId: null,
    emailReminderId: null,
    result: null,
    checklist: [],
  },
  {
    id: "a2",
    horseId: null,
    type: "osteo",
    title: "Bilan ostéopathe",
    date: daysFromNow(6),
    time: "14h00",
    location: "À l'écurie",
    notes: "",
    reminder: "1d",
    reminderNotificationId: null,
    emailReminderId: null,
    result: null,
    checklist: [],
  },
  {
    id: "a3",
    horseId: null,
    type: "marechal",
    title: "Parage",
    date: daysFromNow(18),
    time: "09h30",
    location: "À l'écurie",
    notes: "",
    reminder: "1d",
    reminderNotificationId: null,
    emailReminderId: null,
    result: null,
    checklist: [],
  },
  {
    id: "a4",
    horseId: null,
    type: "concours",
    title: "Concours CSO Club 2",
    date: daysFromNow(27),
    time: "08h00",
    location: "Centre équestre de Bois-Joli",
    notes: "Épreuve à 9h15",
    reminder: "1w",
    reminderNotificationId: null,
    emailReminderId: null,
    result: null,
    checklist: defaultChecklist(),
  },
  {
    id: "a5",
    horseId: null,
    type: "concours",
    title: "Concours CSO Club 1",
    date: daysFromNow(-15),
    time: "08h00",
    location: "Centre équestre de Bois-Joli",
    notes: "",
    reminder: "none",
    reminderNotificationId: null,
    emailReminderId: null,
    result: null,
    checklist: defaultChecklist().map((c) => ({ ...c, checked: true })),
  },
];

const DEFAULT_DOCUMENTS: Doc[] = [
  { id: "d1", category: "ordonnance", name: "Ordonnance vermifuge", date: daysFromNow(-10), fileUri: null, filePath: null },
  { id: "d2", category: "facture", name: "Facture maréchal — mars", date: daysFromNow(-32), fileUri: null, filePath: null },
  { id: "d3", category: "rapport", name: "Rapport bilan vétérinaire annuel", date: daysFromNow(-32), fileUri: null, filePath: null },
];

const DEFAULT_JOURNAL: JournalEntry[] = [];

type AgendaContextValue = {
  appointments: Appointment[];
  documents: Doc[];
  journal: JournalEntry[];
  addAppointment: (appt: NewAppointment) => void;
  deleteAppointment: (appt: Appointment) => void;
  saveResult: (apptId: string, result: string) => void;
  toggleChecklistItem: (apptId: string, itemId: string) => void;
  addChecklistItem: (apptId: string, label: string) => void;
  removeChecklistItem: (apptId: string, itemId: string) => void;
  addDocument: (doc: Omit<Doc, "id" | "filePath">) => void;
  deleteDocument: (docId: string) => void;
  /** Remplace les documents locaux par ceux restaurés depuis le cloud (cf.
   * (auth)/login.tsx) — n'écrit que l'état + SecureStore, ne relance jamais
   * de synchro (on viendrait de recevoir exactement ces données du serveur). */
  hydrateDocumentsFromCloud: (docs: Doc[]) => void;
  hydrateAppointmentsFromCloud: (appts: Appointment[]) => void;
  hydrateJournalFromCloud: (entries: JournalEntry[]) => void;
  addJournalEntry: (entry: Omit<JournalEntry, "id" | "horseId">) => void;
  deleteJournalEntry: (entryId: string) => void;
  /** Efface rendez-vous + documents + journal locaux (cf. suppression de compte dans Profil). */
  clearAll: () => Promise<void>;
};

const AgendaContext = createContext<AgendaContextValue | null>(null);

export function AgendaProvider({ children }: { children: ReactNode }) {
  const { horses, selectedHorse, loading: horsesLoading } = useHorses();
  const [appointments, setAppointments] = useState<Appointment[]>(DEFAULT_APPOINTMENTS);
  const [documents, setDocuments] = useState<Doc[]>(DEFAULT_DOCUMENTS);
  const [journal, setJournal] = useState<JournalEntry[]>(DEFAULT_JOURNAL);
  const [loaded, setLoaded] = useState(false);

  // Charge les données persistées une fois au montage (sinon on garde les mocks par défaut).
  useEffect(() => {
    (async () => {
      const [apptRaw, docRaw, journalRaw] = await Promise.all([
        SecureStore.getItemAsync(APPOINTMENTS_KEY),
        SecureStore.getItemAsync(DOCUMENTS_KEY),
        SecureStore.getItemAsync(JOURNAL_KEY),
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
          }))
        );
      }
      const parsedDocs = safeJsonParse<Doc[] | null>(docRaw, null);
      if (parsedDocs) {
        // fileUri/filePath n'existent pas sur les documents sauvegardés avant
        // leur ajout — les compléter plutôt que de laisser `undefined` (cf. le
        // même souci déjà rencontré sur Horse.restDayActivities).
        setDocuments(
          parsedDocs.map((d) => ({ ...d, date: new Date(d.date), fileUri: d.fileUri ?? null, filePath: d.filePath ?? null }))
        );
      }
      const parsedJournal = safeJsonParse<JournalEntry[] | null>(journalRaw, null);
      if (parsedJournal) {
        setJournal(
          parsedJournal.map((j) => ({ ...j, date: new Date(j.date), horseId: j.horseId ?? null, weather: j.weather ?? null }))
        );
      }
      setLoaded(true);
    })();
  }, []);

  // Rattache au cheval sélectionné/primaire les rendez-vous/entrées de
  // journal créés avant l'introduction de horseId (cf. son commentaire sur
  // Appointment) — attend que l'écurie ait fini de charger pour ne pas
  // rattacher par erreur au cheval de démo par défaut le temps du chargement.
  useEffect(() => {
    if (!loaded || horsesLoading) return;
    const fallbackHorseId = selectedHorse?.id ?? horses.find((h) => h.isPrimary)?.id ?? horses[0]?.id ?? null;
    if (!fallbackHorseId) return;
    setAppointments((list) => (list.every((a) => a.horseId) ? list : list.map((a) => (a.horseId ? a : { ...a, horseId: fallbackHorseId }))));
    setJournal((list) => (list.every((j) => j.horseId) ? list : list.map((j) => (j.horseId ? j : { ...j, horseId: fallbackHorseId }))));
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

  const addAppointment = useCallback(
    (appt: NewAppointment) => {
      const next: Appointment = {
        ...appt,
        id: generateId("a"),
        horseId: selectedHorse?.id ?? null,
        result: null,
        checklist: appt.checklist ?? [],
      };
      setAppointments((list) => [...list, next]);
      pushAppointment(next).catch(() => {});
    },
    [selectedHorse]
  );

  const deleteAppointment = useCallback((appt: Appointment) => {
    cancelReminder(appt.reminderNotificationId);
    cancelEmailReminder(appt.emailReminderId);
    setAppointments((list) => list.filter((a) => a.id !== appt.id));
    deleteAppointmentRemote(appt.id).catch(() => {});
  }, []);

  const saveResult = useCallback((apptId: string, result: string) => {
    setAppointments((list) => list.map((a) => (a.id === apptId ? { ...a, result } : a)));
  }, []);

  const toggleChecklistItem = useCallback((apptId: string, itemId: string) => {
    setAppointments((list) =>
      list.map((a) =>
        a.id === apptId
          ? { ...a, checklist: a.checklist.map((c) => (c.id === itemId ? { ...c, checked: !c.checked } : c)) }
          : a
      )
    );
  }, []);

  const addChecklistItem = useCallback((apptId: string, label: string) => {
    setAppointments((list) =>
      list.map((a) =>
        a.id === apptId
          ? { ...a, checklist: [...a.checklist, { id: generateId("c"), label, checked: false }] }
          : a
      )
    );
  }, []);

  const removeChecklistItem = useCallback((apptId: string, itemId: string) => {
    setAppointments((list) =>
      list.map((a) => (a.id === apptId ? { ...a, checklist: a.checklist.filter((c) => c.id !== itemId) } : a))
    );
  }, []);

  const addDocument = useCallback((doc: Omit<Doc, "id" | "filePath">) => {
    const id = generateId("d");
    const next: Doc = { ...doc, id, filePath: null };
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
  }, []);

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
    (entry: Omit<JournalEntry, "id" | "horseId">) => {
      const next: JournalEntry = { ...entry, id: generateId("j"), horseId: selectedHorse?.id ?? null };
      setJournal((list) => [...list, next]);
      pushJournalEntry(next).catch(() => {});
    },
    [selectedHorse]
  );

  const deleteJournalEntry = useCallback((entryId: string) => {
    setJournal((list) => list.filter((j) => j.id !== entryId));
    deleteJournalEntryRemote(entryId).catch(() => {});
  }, []);

  const clearAll = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(APPOINTMENTS_KEY),
      SecureStore.deleteItemAsync(DOCUMENTS_KEY),
      SecureStore.deleteItemAsync(JOURNAL_KEY),
    ]);
    setAppointments(DEFAULT_APPOINTMENTS);
    setDocuments(DEFAULT_DOCUMENTS);
    setJournal(DEFAULT_JOURNAL);
  }, []);

  const value = useMemo<AgendaContextValue>(
    () => ({
      appointments,
      documents,
      journal,
      addAppointment,
      deleteAppointment,
      saveResult,
      toggleChecklistItem,
      addChecklistItem,
      removeChecklistItem,
      addDocument,
      deleteDocument,
      hydrateDocumentsFromCloud,
      hydrateAppointmentsFromCloud,
      hydrateJournalFromCloud,
      addJournalEntry,
      deleteJournalEntry,
      clearAll,
    }),
    [
      appointments,
      documents,
      journal,
      addAppointment,
      deleteAppointment,
      saveResult,
      toggleChecklistItem,
      addChecklistItem,
      removeChecklistItem,
      addDocument,
      deleteDocument,
      hydrateDocumentsFromCloud,
      hydrateAppointmentsFromCloud,
      hydrateJournalFromCloud,
      addJournalEntry,
      deleteJournalEntry,
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
