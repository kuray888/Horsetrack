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
import { safeJsonParse } from "@/lib/safeJsonParse";

/**
 * Rendez-vous et documents, persistés localement (en attendant Supabase) —
 * accessible depuis tout l'app (pas seulement l'écran Agenda) pour que Today
 * puisse afficher les vrais prochains rendez-vous dans "À venir" plutôt que
 * des données factices déconnectées.
 */

export type AppointmentType = "veto" | "osteo" | "marechal" | "dentiste" | "concours" | "autre";
export type DocumentCategory = "facture" | "rapport" | "ordonnance" | "autre";

export type ChecklistItem = { id: string; label: string; checked: boolean };

export type Appointment = {
  id: string;
  type: AppointmentType;
  title: string;
  date: Date;
  time: string;
  location: string;
  notes: string;
  reminder: ReminderOption;
  /** Id de la notification locale programmée, pour pouvoir l'annuler. Null si pas de rappel programmé. */
  reminderNotificationId: string | null;
  /** Résultat saisi après l'épreuve (concours uniquement). Null si pas encore renseigné. */
  result: string | null;
  /** Checklist de préparation (concours uniquement). Vide pour les autres types. */
  checklist: ChecklistItem[];
};

export type NewAppointment = Omit<Appointment, "id" | "result" | "checklist"> & {
  checklist?: ChecklistItem[];
};

export type Doc = {
  id: string;
  category: DocumentCategory;
  name: string;
  date: Date;
  /** URI locale de la photo du document (copiée dans le stockage persistant
   * de l'app via lib/imagePicker.ts, comme les photos de cheval) — null tant
   * qu'aucune photo n'a été ajoutée. */
  fileUri: string | null;
};

const APPOINTMENTS_KEY = "agenda_appointments_v1";
const DOCUMENTS_KEY = "agenda_documents_v1";

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
    type: "veto",
    title: "Vaccin annuel",
    date: daysFromNow(-32),
    time: "10h00",
    location: "Clinique équine du Val",
    notes: "Rappel grippe + tétanos",
    reminder: "none",
    reminderNotificationId: null,
    result: null,
    checklist: [],
  },
  {
    id: "a2",
    type: "osteo",
    title: "Bilan ostéopathe",
    date: daysFromNow(6),
    time: "14h00",
    location: "À l'écurie",
    notes: "",
    reminder: "1d",
    reminderNotificationId: null,
    result: null,
    checklist: [],
  },
  {
    id: "a3",
    type: "marechal",
    title: "Parage",
    date: daysFromNow(18),
    time: "09h30",
    location: "À l'écurie",
    notes: "",
    reminder: "1d",
    reminderNotificationId: null,
    result: null,
    checklist: [],
  },
  {
    id: "a4",
    type: "concours",
    title: "Concours CSO Club 2",
    date: daysFromNow(27),
    time: "08h00",
    location: "Centre équestre de Bois-Joli",
    notes: "Épreuve à 9h15",
    reminder: "1w",
    reminderNotificationId: null,
    result: null,
    checklist: defaultChecklist(),
  },
  {
    id: "a5",
    type: "concours",
    title: "Concours CSO Club 1",
    date: daysFromNow(-15),
    time: "08h00",
    location: "Centre équestre de Bois-Joli",
    notes: "",
    reminder: "none",
    reminderNotificationId: null,
    result: null,
    checklist: defaultChecklist().map((c) => ({ ...c, checked: true })),
  },
];

const DEFAULT_DOCUMENTS: Doc[] = [
  { id: "d1", category: "ordonnance", name: "Ordonnance vermifuge", date: daysFromNow(-10), fileUri: null },
  { id: "d2", category: "facture", name: "Facture maréchal — mars", date: daysFromNow(-32), fileUri: null },
  { id: "d3", category: "rapport", name: "Rapport bilan vétérinaire annuel", date: daysFromNow(-32), fileUri: null },
];

type AgendaContextValue = {
  appointments: Appointment[];
  documents: Doc[];
  addAppointment: (appt: NewAppointment) => void;
  deleteAppointment: (appt: Appointment) => void;
  saveResult: (apptId: string, result: string) => void;
  toggleChecklistItem: (apptId: string, itemId: string) => void;
  addChecklistItem: (apptId: string, label: string) => void;
  removeChecklistItem: (apptId: string, itemId: string) => void;
  addDocument: (doc: Omit<Doc, "id">) => void;
  deleteDocument: (docId: string) => void;
  /** Efface rendez-vous + documents locaux (cf. suppression de compte dans Profil). */
  clearAll: () => Promise<void>;
};

const AgendaContext = createContext<AgendaContextValue | null>(null);

export function AgendaProvider({ children }: { children: ReactNode }) {
  const [appointments, setAppointments] = useState<Appointment[]>(DEFAULT_APPOINTMENTS);
  const [documents, setDocuments] = useState<Doc[]>(DEFAULT_DOCUMENTS);
  const [loaded, setLoaded] = useState(false);

  // Charge les données persistées une fois au montage (sinon on garde les mocks par défaut).
  useEffect(() => {
    (async () => {
      const [apptRaw, docRaw] = await Promise.all([
        SecureStore.getItemAsync(APPOINTMENTS_KEY),
        SecureStore.getItemAsync(DOCUMENTS_KEY),
      ]);
      const parsedAppts = safeJsonParse<Appointment[] | null>(apptRaw, null);
      if (parsedAppts) {
        setAppointments(
          parsedAppts.map((a) => ({
            ...a,
            date: new Date(a.date),
            result: a.result ?? null,
            checklist: a.checklist ?? (a.type === "concours" ? defaultChecklist() : []),
          }))
        );
      }
      const parsedDocs = safeJsonParse<Doc[] | null>(docRaw, null);
      if (parsedDocs) {
        // fileUri n'existe pas sur les documents sauvegardés avant son ajout —
        // le compléter plutôt que de laisser `undefined` (cf. le même souci
        // déjà rencontré sur Horse.restDayActivities).
        setDocuments(parsedDocs.map((d) => ({ ...d, date: new Date(d.date), fileUri: d.fileUri ?? null })));
      }
      setLoaded(true);
    })();
  }, []);

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

  const addAppointment = useCallback((appt: NewAppointment) => {
    setAppointments((list) => [...list, { ...appt, id: String(Date.now()), result: null, checklist: appt.checklist ?? [] }]);
  }, []);

  const deleteAppointment = useCallback((appt: Appointment) => {
    cancelReminder(appt.reminderNotificationId);
    setAppointments((list) => list.filter((a) => a.id !== appt.id));
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
          ? { ...a, checklist: [...a.checklist, { id: `c${Date.now()}`, label, checked: false }] }
          : a
      )
    );
  }, []);

  const removeChecklistItem = useCallback((apptId: string, itemId: string) => {
    setAppointments((list) =>
      list.map((a) => (a.id === apptId ? { ...a, checklist: a.checklist.filter((c) => c.id !== itemId) } : a))
    );
  }, []);

  const addDocument = useCallback((doc: Omit<Doc, "id">) => {
    setDocuments((list) => [...list, { ...doc, id: String(Date.now()) }]);
  }, []);

  const deleteDocument = useCallback((docId: string) => {
    setDocuments((list) => list.filter((d) => d.id !== docId));
  }, []);

  const clearAll = useCallback(async () => {
    await Promise.all([SecureStore.deleteItemAsync(APPOINTMENTS_KEY), SecureStore.deleteItemAsync(DOCUMENTS_KEY)]);
    setAppointments(DEFAULT_APPOINTMENTS);
    setDocuments(DEFAULT_DOCUMENTS);
  }, []);

  const value = useMemo<AgendaContextValue>(
    () => ({
      appointments,
      documents,
      addAppointment,
      deleteAppointment,
      saveResult,
      toggleChecklistItem,
      addChecklistItem,
      removeChecklistItem,
      addDocument,
      deleteDocument,
      clearAll,
    }),
    [appointments, documents, addAppointment, deleteAppointment, saveResult, toggleChecklistItem, addChecklistItem, removeChecklistItem, addDocument, deleteDocument, clearAll]
  );

  return <AgendaContext.Provider value={value}>{children}</AgendaContext.Provider>;
}

export function useAgenda() {
  const ctx = useContext(AgendaContext);
  if (!ctx) throw new Error("useAgenda doit être utilisé dans <AgendaProvider>");
  return ctx;
}
