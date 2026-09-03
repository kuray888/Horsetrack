import { useEffect, useState } from "react";
import { Image, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { colors } from "@/theme/colors";
import { FadeInView } from "@/components/FadeInView";
import { Field } from "@/components/Field";
import { DatePickerField } from "@/components/DatePickerField";
import { TimePickerField } from "@/components/TimePickerField";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { PrimaryButton } from "@/components/onboarding";
import { formatDate } from "@/lib/dateFormat";
import { computeReminderTrigger, ensureNotificationPermission, scheduleReminder, type ReminderOption } from "@/lib/notifications";
import { scheduleEmailReminder } from "@/lib/emailReminders";
import { fetchWeatherSnapshot } from "@/lib/weather";
import { pickAndPersistImage } from "@/lib/imagePicker";
import { useHorses } from "@/horses/store";
import { useSubscription } from "@/subscription/store";
import { Locked } from "@/components/Locked";
import { DISCIPLINES } from "@/onboarding/options";
import type { Discipline } from "@/onboarding/store";
import {
  useAgenda,
  daysFromNow,
  defaultChecklist,
  type Appointment,
  type AppointmentType,
  type CompetitionEntry,
  type Doc,
  type DocumentCategory,
  type Expense,
  type ExpenseCategory,
  type JournalEntry,
  type ActivityType,
  type Mood,
  ACTIVITY_META,
} from "@/agenda/store";

const DISCIPLINE_META: Record<Discipline, { label: string; icon: IconSpec }> = Object.fromEntries(
  DISCIPLINES.map((d) => [
    d.value,
    { label: d.label, icon: d.icon ?? { name: "horse-variant" as const, color: colors.primary } },
  ])
) as Record<Discipline, { label: string; icon: IconSpec }>;

/** id local le temps du formulaire de création (avant que l'épreuve ait un
 * vrai id, généré par addCompetitionEntry/addAppointment côté store). */
function newDraftEntryId(): string {
  return `draft${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

type IconSpec = { name: keyof typeof MaterialCommunityIcons.glyphMap; color: string };

const APPT_META: Record<AppointmentType, { label: string; icon: IconSpec; chip: string; tag: string }> = {
  veto: { label: "Vétérinaire", icon: { name: "needle", color: colors.warning }, chip: "bg-warning/15", tag: "text-warning" },
  osteo: { label: "Ostéopathe", icon: { name: "bone", color: colors.accent }, chip: "bg-accent/15", tag: "text-accent" },
  marechal: { label: "Maréchal-ferrant", icon: { name: "hammer", color: colors.primary }, chip: "bg-primary/15", tag: "text-primary" },
  dentiste: { label: "Dentiste équin", icon: { name: "tooth-outline", color: colors.success }, chip: "bg-success/15", tag: "text-success" },
  concours: { label: "Concours", icon: { name: "trophy-outline", color: colors.accent }, chip: "bg-accent/15", tag: "text-accent" },
  autre: { label: "Autre", icon: { name: "calendar-blank-outline", color: colors.textMuted }, chip: "bg-border", tag: "text-muted" },
};

const DOC_META: Record<DocumentCategory, { label: string; icon: IconSpec; chip: string; tag: string }> = {
  facture: { label: "Facture", icon: { name: "receipt", color: colors.primary }, chip: "bg-primary/15", tag: "text-primary" },
  rapport: { label: "Rapport", icon: { name: "clipboard-text-outline", color: colors.accent }, chip: "bg-accent/15", tag: "text-accent" },
  ordonnance: { label: "Ordonnance", icon: { name: "pill", color: colors.warning }, chip: "bg-warning/15", tag: "text-warning" },
  autre: { label: "Autre", icon: { name: "paperclip", color: colors.textMuted }, chip: "bg-border", tag: "text-muted" },
};

const EXPENSE_META: Record<ExpenseCategory, { label: string; icon: IconSpec; chip: string; tag: string }> = {
  veto: { label: "Vétérinaire", icon: { name: "needle", color: colors.warning }, chip: "bg-warning/15", tag: "text-warning" },
  marechal: { label: "Maréchal-ferrant", icon: { name: "hammer", color: colors.primary }, chip: "bg-primary/15", tag: "text-primary" },
  concours: { label: "Concours", icon: { name: "trophy-outline", color: colors.accent }, chip: "bg-accent/15", tag: "text-accent" },
  alimentation: { label: "Alimentation", icon: { name: "grass", color: colors.success }, chip: "bg-success/15", tag: "text-success" },
  materiel: { label: "Matériel", icon: { name: "toolbox-outline", color: colors.accent }, chip: "bg-accent/15", tag: "text-accent" },
  autre: { label: "Autre", icon: { name: "tag-outline", color: colors.textMuted }, chip: "bg-border", tag: "text-muted" },
};

/** Catégories de dépense qui correspondent à un type de rendez-vous du même
 * nom (cf. suggestion de rapprochement dans le formulaire d'ajout) — les
 * valeurs locales des deux unions coïncident déjà (veto/marechal/concours). */
function expenseCategoryToAppointmentType(category: ExpenseCategory): AppointmentType | null {
  return category === "veto" || category === "marechal" || category === "concours" ? category : null;
}

const REMINDER_META: Record<ReminderOption, { label: string; icon: IconSpec }> = {
  none: { label: "Aucun", icon: { name: "bell-off-outline", color: colors.textMuted } },
  "1h": { label: "1 heure avant", icon: { name: "bell-outline", color: colors.accent } },
  "1d": { label: "1 jour avant", icon: { name: "bell-outline", color: colors.accent } },
  "1w": { label: "1 semaine avant", icon: { name: "bell-outline", color: colors.accent } },
};

const MOOD_META: Record<Mood, { emoji: string; label: string }> = {
  great: { emoji: "🤩", label: "Top" },
  good: { emoji: "🙂", label: "Bien" },
  okay: { emoji: "😐", label: "Moyen" },
  hard: { emoji: "😣", label: "Difficile" },
};

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

function ChipSelect<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon: string | IconSpec }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
            accessibilityLabel={opt.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`flex-row items-center gap-1.5 rounded-full border px-3.5 py-2 ${
              selected ? "border-primary bg-highlight" : "border-border bg-surface"
            }`}
          >
            {typeof opt.icon === "string" ? (
              <Text className="text-sm" accessibilityElementsHidden importantForAccessibility="no">
                {opt.icon}
              </Text>
            ) : (
              <MaterialCommunityIcons name={opt.icon.name} size={15} color={opt.icon.color} accessibilityElementsHidden />
            )}
            <Text className={`text-sm font-semibold ${selected ? "text-primary" : "text-text"}`}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function AddToggle({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-primary p-4"
    >
      <MaterialCommunityIcons name="plus" size={18} color={colors.primary} />
      <Text className="text-base font-semibold text-primary">{label}</Text>
    </TouchableOpacity>
  );
}

const emptyApptForm = {
  type: "veto" as AppointmentType,
  title: "",
  date: null as Date | null,
  time: "09h00",
  location: "",
  reminder: "1d" as ReminderOption,
  dossard: "",
  competitionEntries: [] as CompetitionEntry[],
};
const emptyDocForm = {
  category: "facture" as DocumentCategory,
  name: "",
  date: null as Date | null,
  fileUri: null as string | null,
};
const emptyJournalForm = {
  activityType: "dressage" as ActivityType,
  mood: "good" as Mood,
  notes: "",
  date: daysFromNow(0) as Date | null,
  time: "09h00",
};
const emptyExpenseForm = {
  category: "veto" as ExpenseCategory,
  amount: "",
  date: daysFromNow(0) as Date | null,
  notes: "",
  appointmentId: null as string | null,
};

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
}

export default function AgendaScreen() {
  const { selectedHorse: horse } = useHorses();
  const { isActiveOrTrialing } = useSubscription();
  const {
    appointments,
    documents,
    journal,
    expenses,
    addAppointment,
    deleteAppointment,
    saveResult,
    toggleChecklistItem,
    addChecklistItem,
    removeChecklistItem,
    addCompetitionEntry,
    updateCompetitionEntryResult,
    deleteCompetitionEntry,
    addDocument,
    deleteDocument,
    addJournalEntry,
    deleteJournalEntry,
    addExpense,
    deleteExpense,
    toggleExpensePaid,
  } = useAgenda();
  const [section, setSection] = useState<"appointments" | "documents" | "journal" | "finances">("appointments");
  const [notifPermission, setNotifPermission] = useState<boolean | null>(null);

  useEffect(() => {
    ensureNotificationPermission().then(setNotifPermission);
  }, []);

  const [showApptForm, setShowApptForm] = useState(false);
  const [apptForm, setApptForm] = useState(emptyApptForm);
  const [submittingAppt, setSubmittingAppt] = useState(false);
  const [expandedApptId, setExpandedApptId] = useState<string | null>(null);
  const [showPastAppts, setShowPastAppts] = useState(false);

  const [showDocForm, setShowDocForm] = useState(false);
  const [docForm, setDocForm] = useState(emptyDocForm);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

  const [showJournalForm, setShowJournalForm] = useState(false);
  const [journalForm, setJournalForm] = useState(emptyJournalForm);
  const [expandedJournalId, setExpandedJournalId] = useState<string | null>(null);
  const [savingJournal, setSavingJournal] = useState(false);

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);

  const today = daysFromNow(0);

  // Rendez-vous et journal sont rattachés à un cheval (cf. agenda/store.tsx) —
  // le partage DP/coach se fait par cheval, donc cet écran ne montre que ceux
  // du cheval actuellement sélectionné. Les documents (coffre-fort) restent
  // volontairement non filtrés : ils ne sont pas rattachés à un cheval (hors
  // scope du partage, cf. plan de la session sur le partage).
  const horseAppointments = appointments.filter((a) => a.horseId === horse?.id);
  const horseJournal = journal.filter((j) => j.horseId === horse?.id);
  const horseExpenses = expenses.filter((e) => e.horseId === horse?.id);

  const upcomingAppts = horseAppointments.filter((a) => a.date >= today).sort((a, b) => a.date.getTime() - b.date.getTime());
  // Historique complet pour tout le monde, gratuit comme Premium — pas de
  // plafond du type "14 jours en gratuit" (cf. rls.sql appointments_shared,
  // non gaté par abonnement).
  const pastAppts = horseAppointments.filter((a) => a.date < today).sort((a, b) => b.date.getTime() - a.date.getTime());

  const sortedDocs = [...documents].sort((a, b) => b.date.getTime() - a.date.getTime());

  const sortedJournal = [...horseJournal].sort((a, b) => b.date.getTime() - a.date.getTime());

  const sortedExpenses = [...horseExpenses].sort((a, b) => b.date.getTime() - a.date.getTime());
  // Toutes les dépenses sont en EUR pour l'instant (cf. Expense.currency) —
  // un total multi-devises n'aurait pas de sens sans conversion, hors scope.
  const totalExpenses = sortedExpenses.reduce((sum, e) => sum + e.amount, 0);
  // Statut payé/à régler Premium (cf. Expense.isPaid) — en gratuit, tout
  // reste "à régler" faute de pouvoir basculer le statut, cf. handleAddExpense.
  const paidExpenses = sortedExpenses.filter((e) => e.isPaid).reduce((sum, e) => sum + e.amount, 0);
  const pendingExpenses = totalExpenses - paidExpenses;

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

  async function handleAddAppointment() {
    const date = apptForm.date;
    if (!apptForm.title.trim() || !date || !horse || submittingAppt) return;
    setSubmittingAppt(true);

    const title = apptForm.title.trim();
    const time = apptForm.time.trim();
    const location = apptForm.location.trim();
    // Les rappels programmés (push + email) sont Premium (cf. champ "Rappel"
    // verrouillé dans le formulaire) — sans ce clamp, un compte gratuit
    // soumettrait quand même la valeur par défaut du formulaire ("1d").
    const reminder: ReminderOption = isActiveOrTrialing ? apptForm.reminder : "none";
    const trigger = computeReminderTrigger(date, time, reminder);
    const notifBody = `${formatDate(date)}${time ? ` à ${time}` : ""}${location ? ` · ${location}` : ""}`;
    // L'échec de programmation du rappel (permission révoquée, erreur OS) ne
    // doit jamais empêcher l'ajout du rendez-vous lui-même.
    let reminderNotificationId: string | null = null;
    let emailReminderId: string | null = null;
    if (trigger) {
      try {
        reminderNotificationId = await scheduleReminder(`Rappel : ${title}`, notifBody, trigger);
      } catch {
        reminderNotificationId = null;
      }
      setNotifPermission((prev) => (!reminderNotificationId ? false : prev));
      emailReminderId = await scheduleEmailReminder(trigger, `Rappel : ${title}`, notifBody);
    }

    const isConcours = apptForm.type === "concours";
    try {
      addAppointment({
        type: apptForm.type,
        title,
        date,
        time,
        location,
        notes: "",
        reminder,
        reminderNotificationId,
        emailReminderId,
        checklist: isConcours ? defaultChecklist() : [],
        dossard: isConcours ? apptForm.dossard.trim() || null : null,
        // Plusieurs épreuves par concours est Premium (cf. section "Épreuves"
        // verrouillée dans le formulaire, et competition_entries_insert_shared
        // côté rls.sql) — sans ce clamp, un compte gratuit créerait des
        // entrées localement qu'un push cloud rejetterait ensuite, désynchro-
        // nisant l'app du serveur.
        competitionEntries:
          isConcours && isActiveOrTrialing
            ? apptForm.competitionEntries.filter((e) => e.name.trim() && e.time.trim())
            : [],
      });
      setApptForm(emptyApptForm);
      setShowApptForm(false);
    } finally {
      setSubmittingAppt(false);
    }
  }

  function addApptFormEntry() {
    setApptForm((f) => ({
      ...f,
      competitionEntries: [
        ...f.competitionEntries,
        { id: newDraftEntryId(), name: "", discipline: "SHOW_JUMPING", time: "", result: null },
      ],
    }));
  }

  function updateApptFormEntry(id: string, patch: Partial<CompetitionEntry>) {
    setApptForm((f) => ({
      ...f,
      competitionEntries: f.competitionEntries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }

  function removeApptFormEntry(id: string) {
    setApptForm((f) => ({ ...f, competitionEntries: f.competitionEntries.filter((e) => e.id !== id) }));
  }

  function handleAddDocument() {
    const date = docForm.date;
    if (!docForm.name.trim() || !date) return;
    addDocument({ category: docForm.category, name: docForm.name.trim(), date, fileUri: docForm.fileUri });
    setDocForm(emptyDocForm);
    setShowDocForm(false);
  }

  async function handlePickDocPhoto() {
    const uri = await pickAndPersistImage();
    if (uri) setDocForm((f) => ({ ...f, fileUri: uri }));
  }

  async function handleAddJournalEntry() {
    const date = journalForm.date;
    if (!date) return;
    setSavingJournal(true);
    try {
      // Best-effort, jamais bloquant : un refus de position/permission ne
      // doit pas empêcher d'enregistrer l'entrée de journal.
      const weather = await fetchWeatherSnapshot();
      addJournalEntry({
        activityType: journalForm.activityType,
        mood: journalForm.mood,
        notes: journalForm.notes.trim(),
        date,
        time: journalForm.time.trim(),
        weather,
      });
      setJournalForm(emptyJournalForm);
      setShowJournalForm(false);
    } finally {
      setSavingJournal(false);
    }
  }

  function handleAddExpense() {
    const date = expenseForm.date;
    const amount = Number(expenseForm.amount.replace(",", "."));
    if (!date || !expenseForm.amount.trim() || !Number.isFinite(amount) || amount <= 0) return;
    addExpense({
      amount,
      currency: "EUR",
      category: expenseForm.category,
      date,
      notes: expenseForm.notes.trim(),
      appointmentId: expenseForm.appointmentId,
      documentId: null,
      // Le statut payé/à régler se règle après coup depuis la liste (cf.
      // toggle Premium sur chaque dépense) — une dépense vient d'être créée,
      // elle est donc "à régler" par défaut.
      isPaid: false,
    });
    setExpenseForm(emptyExpenseForm);
    setShowExpenseForm(false);
  }

  return (
    <>
    <Screen>
      <FadeInView>
        <View className="gap-1">
          <Text className="text-3xl font-extrabold tracking-tight text-text">Agenda</Text>
          <Text className="text-base text-muted">Rendez-vous et documents de {horse?.name ?? "ton cheval"}</Text>
        </View>
      </FadeInView>

      <FadeInView delay={80}>
        <View className="flex-row gap-2 rounded-full bg-surface p-1.5 shadow-card">
          <TouchableOpacity
            onPress={() => setSection("appointments")}
            activeOpacity={0.85}
            className={`flex-1 items-center rounded-full p-2.5 ${section === "appointments" ? "bg-primary" : ""}`}
          >
            <Text
              className={`text-sm font-bold ${section === "appointments" ? "text-on-primary" : "text-muted"}`}
            >
              Rendez-vous
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSection("documents")}
            activeOpacity={0.85}
            className={`flex-1 items-center rounded-full p-2.5 ${section === "documents" ? "bg-primary" : ""}`}
          >
            <Text
              className={`text-sm font-bold ${section === "documents" ? "text-on-primary" : "text-muted"}`}
            >
              Documents
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSection("journal")}
            activeOpacity={0.85}
            className={`flex-1 items-center rounded-full p-2.5 ${section === "journal" ? "bg-primary" : ""}`}
          >
            <Text
              className={`text-sm font-bold ${section === "journal" ? "text-on-primary" : "text-muted"}`}
            >
              Journal
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSection("finances")}
            activeOpacity={0.85}
            className={`flex-1 items-center rounded-full p-2.5 ${section === "finances" ? "bg-primary" : ""}`}
          >
            <Text
              className={`text-sm font-bold ${section === "finances" ? "text-on-primary" : "text-muted"}`}
            >
              Finances
            </Text>
          </TouchableOpacity>
        </View>
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
            {showApptForm ? (
              <View className={`${CARD} gap-3`}>
                <Text className="text-sm font-bold uppercase tracking-wide text-accent">
                  Nouveau rendez-vous
                </Text>
                <Field label="Type de rendez-vous">
                  <ChipSelect
                    options={Object.entries(APPT_META).map(([value, meta]) => ({
                      value: value as AppointmentType,
                      label: meta.label,
                      icon: meta.icon,
                    }))}
                    value={apptForm.type}
                    onChange={(type) => setApptForm((f) => ({ ...f, type }))}
                  />
                </Field>
                <Field label="Titre">
                  <TextInput
                    className={INPUT}
                    placeholder="Ex : Vaccin annuel"
                    value={apptForm.title}
                    onChangeText={(title) => setApptForm((f) => ({ ...f, title }))}
                  />
                </Field>
                <DatePickerField
                  label="Date"
                  value={apptForm.date}
                  onChange={(date) => setApptForm((f) => ({ ...f, date }))}
                />
                <TimePickerField
                  label="Heure"
                  value={apptForm.time}
                  onChange={(time) => setApptForm((f) => ({ ...f, time }))}
                />
                <Field label="Lieu (optionnel)">
                  <TextInput
                    className={INPUT}
                    placeholder="Ex : Clinique équine du Val"
                    value={apptForm.location}
                    onChangeText={(location) => setApptForm((f) => ({ ...f, location }))}
                  />
                </Field>
                <Locked message="Rappels automatiques réservés à l'abonnement Premium">
                  <Field label="Rappel">
                    <ChipSelect
                      options={Object.entries(REMINDER_META).map(([value, meta]) => ({
                        value: value as ReminderOption,
                        label: meta.label,
                        icon: meta.icon,
                      }))}
                      value={apptForm.reminder}
                      onChange={(reminder) => setApptForm((f) => ({ ...f, reminder }))}
                    />
                  </Field>
                </Locked>
                {apptForm.type === "concours" ? (
                  <>
                    <Field label="Dossard (optionnel)">
                      <TextInput
                        className={INPUT}
                        placeholder="Ex : 142"
                        value={apptForm.dossard}
                        onChangeText={(dossard) => setApptForm((f) => ({ ...f, dossard }))}
                        keyboardType="number-pad"
                      />
                    </Field>
                    <Locked message="Plusieurs épreuves par concours réservé à l'abonnement Premium">
                      <View className="gap-2">
                        <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Épreuves</Text>
                        {apptForm.competitionEntries.map((entry) => (
                          <View key={entry.id} className="gap-2 rounded-card border border-border p-3">
                            <View className="flex-row items-center gap-2">
                              <TextInput
                                className={`${INPUT} flex-1`}
                                placeholder="Ex : Épreuve club 2 — 1m10"
                                value={entry.name}
                                onChangeText={(name) => updateApptFormEntry(entry.id, { name })}
                              />
                              <TouchableOpacity onPress={() => removeApptFormEntry(entry.id)} hitSlop={8} activeOpacity={0.7}>
                                <Text className="text-sm text-muted">✕</Text>
                              </TouchableOpacity>
                            </View>
                            <ChipSelect
                              options={Object.entries(DISCIPLINE_META).map(([value, meta]) => ({
                                value: value as Discipline,
                                label: meta.label,
                                icon: meta.icon,
                              }))}
                              value={entry.discipline}
                              onChange={(discipline) => updateApptFormEntry(entry.id, { discipline })}
                            />
                            <TextInput
                              className={INPUT}
                              placeholder="Heure de l'épreuve (ex : 09h15)"
                              value={entry.time}
                              onChangeText={(time) => updateApptFormEntry(entry.id, { time })}
                            />
                          </View>
                        ))}
                        <TouchableOpacity
                          onPress={addApptFormEntry}
                          activeOpacity={0.8}
                          className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-border p-3"
                        >
                          <Text className="text-sm font-semibold text-accent">＋ Ajouter une épreuve</Text>
                        </TouchableOpacity>
                      </View>
                    </Locked>
                  </>
                ) : null}
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => {
                      setShowApptForm(false);
                      setApptForm(emptyApptForm);
                    }}
                    className="flex-1 items-center rounded-card border border-border p-4"
                  >
                    <Text className="text-base font-semibold text-muted">Annuler</Text>
                  </TouchableOpacity>
                  <View className="flex-1">
                    <PrimaryButton
                      label={submittingAppt ? "Un instant…" : "Ajouter"}
                      disabled={!apptForm.title.trim() || !apptForm.date || submittingAppt}
                      onPress={handleAddAppointment}
                    />
                  </View>
                </View>
              </View>
            ) : (
              <AddToggle label="Ajouter un rendez-vous" onPress={() => setShowApptForm(true)} />
            )}
          </FadeInView>

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
                  onDelete={() => deleteAppointment(appt)}
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
                    onDelete={() => deleteAppointment(appt)}
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
            {showDocForm ? (
              <View className={`${CARD} gap-3`}>
                <Text className="text-sm font-bold uppercase tracking-wide text-accent">Nouveau document</Text>
                <Field label="Catégorie">
                  <ChipSelect
                    options={Object.entries(DOC_META).map(([value, meta]) => ({
                      value: value as DocumentCategory,
                      label: meta.label,
                      icon: meta.icon,
                    }))}
                    value={docForm.category}
                    onChange={(category) => setDocForm((f) => ({ ...f, category }))}
                  />
                </Field>
                <Field label="Nom du document">
                  <TextInput
                    className={INPUT}
                    placeholder="Ex : Facture maréchal"
                    value={docForm.name}
                    onChangeText={(name) => setDocForm((f) => ({ ...f, name }))}
                  />
                </Field>
                <DatePickerField
                  label="Date"
                  value={docForm.date}
                  onChange={(date) => setDocForm((f) => ({ ...f, date }))}
                />
                {docForm.fileUri ? (
                  <TouchableOpacity onPress={handlePickDocPhoto} activeOpacity={0.8} className="gap-2">
                    <Image source={{ uri: docForm.fileUri }} className="h-32 w-full rounded-card" resizeMode="cover" />
                    <Text className="text-center text-sm font-semibold text-accent">Changer la photo</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={handlePickDocPhoto}
                    activeOpacity={0.8}
                    className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-border p-4"
                  >
                    <MaterialCommunityIcons name="paperclip" size={17} color={colors.textMuted} />
                    <Text className="text-sm font-semibold text-muted">Joindre une photo du document</Text>
                  </TouchableOpacity>
                )}
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => {
                      setShowDocForm(false);
                      setDocForm(emptyDocForm);
                    }}
                    className="flex-1 items-center rounded-card border border-border p-4"
                  >
                    <Text className="text-base font-semibold text-muted">Annuler</Text>
                  </TouchableOpacity>
                  <View className="flex-1">
                    <PrimaryButton
                      label="Ajouter"
                      disabled={!docForm.name.trim() || !docForm.date}
                      onPress={handleAddDocument}
                    />
                  </View>
                </View>
              </View>
            ) : (
              <Locked message="Abonne-toi pour ajouter un document">
                <AddToggle label="Ajouter un document" onPress={() => setShowDocForm(true)} />
              </Locked>
            )}
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
                  onDelete={() => deleteDocument(doc.id)}
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
            {showJournalForm ? (
              <View className={`${CARD} gap-3`}>
                <Text className="text-sm font-bold uppercase tracking-wide text-accent">Nouvelle entrée de journal</Text>
                <Field label="Activité">
                  <ChipSelect
                    options={Object.entries(ACTIVITY_META).map(([value, meta]) => ({
                      value: value as ActivityType,
                      label: meta.label,
                      icon: { name: meta.icon, color: meta.tint },
                    }))}
                    value={journalForm.activityType}
                    onChange={(activityType) => setJournalForm((f) => ({ ...f, activityType }))}
                  />
                </Field>
                <Field label="Ressenti">
                  <ChipSelect
                    options={Object.entries(MOOD_META).map(([value, meta]) => ({
                      value: value as Mood,
                      label: meta.label,
                      icon: meta.emoji,
                    }))}
                    value={journalForm.mood}
                    onChange={(mood) => setJournalForm((f) => ({ ...f, mood }))}
                  />
                </Field>
                <DatePickerField
                  label="Date"
                  value={journalForm.date}
                  onChange={(date) => setJournalForm((f) => ({ ...f, date }))}
                />
                <TimePickerField
                  label="Heure"
                  value={journalForm.time}
                  onChange={(time) => setJournalForm((f) => ({ ...f, time }))}
                />
                <View className="gap-1.5">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Notes (optionnel)</Text>
                  <TextInput
                    className={INPUT}
                    placeholder="Ex : très bonne séance, cheval détendu"
                    value={journalForm.notes}
                    onChangeText={(notes) => setJournalForm((f) => ({ ...f, notes }))}
                    multiline
                  />
                </View>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => {
                      setShowJournalForm(false);
                      setJournalForm(emptyJournalForm);
                    }}
                    className="flex-1 items-center rounded-card border border-border p-4"
                  >
                    <Text className="text-base font-semibold text-muted">Annuler</Text>
                  </TouchableOpacity>
                  <View className="flex-1">
                    <PrimaryButton
                      label={savingJournal ? "Un instant…" : "Ajouter"}
                      disabled={!journalForm.date || savingJournal}
                      onPress={handleAddJournalEntry}
                    />
                  </View>
                </View>
              </View>
            ) : (
              <AddToggle label="Ajouter une entrée de journal" onPress={() => setShowJournalForm(true)} />
            )}
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
                  onDelete={() => deleteJournalEntry(entry.id)}
                />
              </FadeInView>
            ))
          )}
        </>
      ) : (
        <>
          {sortedExpenses.length > 0 ? (
            <FadeInView delay={100}>
              <Locked message="Détail payé/à régler réservé à l'abonnement Premium">
                <View className={`${CARD} flex-row items-center justify-between`}>
                  <View className="items-center gap-0.5">
                    <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Total</Text>
                    <Text className="text-lg font-extrabold text-text">{formatAmount(totalExpenses, "EUR")}</Text>
                  </View>
                  <View className="items-center gap-0.5">
                    <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Payé</Text>
                    <Text className="text-lg font-extrabold text-success">{formatAmount(paidExpenses, "EUR")}</Text>
                  </View>
                  <View className="items-center gap-0.5">
                    <Text className="text-xs font-semibold uppercase tracking-wide text-muted">À payer</Text>
                    <Text className="text-lg font-extrabold text-danger">{formatAmount(pendingExpenses, "EUR")}</Text>
                  </View>
                </View>
              </Locked>
            </FadeInView>
          ) : null}

          <FadeInView delay={140}>
            {showExpenseForm ? (
              <View className={`${CARD} gap-3`}>
                <Text className="text-sm font-bold uppercase tracking-wide text-accent">Nouvelle dépense</Text>
                <Field label="Catégorie">
                  <ChipSelect
                    options={Object.entries(EXPENSE_META).map(([value, meta]) => ({
                      value: value as ExpenseCategory,
                      label: meta.label,
                      icon: meta.icon,
                    }))}
                    value={expenseForm.category}
                    onChange={(category) => setExpenseForm((f) => ({ ...f, category, appointmentId: null }))}
                  />
                </Field>
                <Field label="Montant (€)">
                  <TextInput
                    className={INPUT}
                    placeholder="Ex : 45"
                    value={expenseForm.amount}
                    onChangeText={(amount) => setExpenseForm((f) => ({ ...f, amount }))}
                    keyboardType="decimal-pad"
                  />
                </Field>
                <DatePickerField
                  label="Date"
                  value={expenseForm.date}
                  onChange={(date) => setExpenseForm((f) => ({ ...f, date }))}
                />
                <View className="gap-1.5">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Notes (optionnel)</Text>
                  <TextInput
                    className={INPUT}
                    placeholder="Ex : Vermifuge d'automne"
                    value={expenseForm.notes}
                    onChangeText={(notes) => setExpenseForm((f) => ({ ...f, notes }))}
                  />
                </View>
                {(() => {
                  const suggestion = suggestedAppointmentFor(expenseForm.category);
                  if (!suggestion) return null;
                  const linked = expenseForm.appointmentId === suggestion.id;
                  return (
                    <TouchableOpacity
                      onPress={() =>
                        setExpenseForm((f) => ({ ...f, appointmentId: linked ? null : suggestion.id }))
                      }
                      activeOpacity={0.8}
                      className={`flex-row items-center gap-2 rounded-card border p-3 ${
                        linked ? "border-primary bg-highlight" : "border-dashed border-border"
                      }`}
                    >
                      <MaterialCommunityIcons
                        name={linked ? "check-circle-outline" : "link-variant"}
                        size={18}
                        color={linked ? colors.primary : colors.textMuted}
                      />
                      <Text className="flex-1 text-sm text-text">
                        {linked ? "Lié à " : "Lier à "}
                        <Text className="font-semibold">{suggestion.title}</Text> ({formatDate(suggestion.date)})
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => {
                      setShowExpenseForm(false);
                      setExpenseForm(emptyExpenseForm);
                    }}
                    className="flex-1 items-center rounded-card border border-border p-4"
                  >
                    <Text className="text-base font-semibold text-muted">Annuler</Text>
                  </TouchableOpacity>
                  <View className="flex-1">
                    <PrimaryButton
                      label="Ajouter"
                      disabled={!expenseForm.amount.trim() || !expenseForm.date}
                      onPress={handleAddExpense}
                    />
                  </View>
                </View>
              </View>
            ) : (
              <AddToggle label="Ajouter une dépense" onPress={() => setShowExpenseForm(true)} />
            )}
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
                  onDelete={() => deleteExpense(expense.id)}
                  onTogglePaid={() => toggleExpensePaid(expense.id)}
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

function AppointmentCard({
  appt,
  expanded,
  onToggleExpand,
  onDelete,
  onSaveResult,
  onToggleChecklistItem,
  onAddChecklistItem,
  onRemoveChecklistItem,
  onAddCompetitionEntry,
  onUpdateCompetitionEntryResult,
  onDeleteCompetitionEntry,
}: {
  appt: Appointment;
  expanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  onSaveResult: (result: string) => void;
  onToggleChecklistItem: (itemId: string) => void;
  onAddChecklistItem: (label: string) => void;
  onRemoveChecklistItem: (itemId: string) => void;
  onAddCompetitionEntry: (entry: Omit<CompetitionEntry, "id" | "result">) => void;
  onUpdateCompetitionEntryResult: (entryId: string, result: string) => void;
  onDeleteCompetitionEntry: (entryId: string) => void;
}) {
  const meta = APPT_META[appt.type];
  const [editingResult, setEditingResult] = useState(false);
  const [draftResult, setDraftResult] = useState(appt.result ?? "");
  const [newItemLabel, setNewItemLabel] = useState("");
  const isConcours = appt.type === "concours";
  const isPastConcours = isConcours && appt.date < daysFromNow(0);

  function handleSaveResult() {
    if (!draftResult.trim()) return;
    onSaveResult(draftResult.trim());
    setEditingResult(false);
  }

  function handleAddChecklistItem() {
    const label = newItemLabel.trim();
    if (!label) return;
    onAddChecklistItem(label);
    setNewItemLabel("");
  }

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onToggleExpand} className={CARD}>
      <View className="flex-row items-center gap-3">
        <View className={`h-11 w-11 items-center justify-center rounded-full ${meta.chip}`}>
          <MaterialCommunityIcons name={meta.icon.name} size={20} color={meta.icon.color} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-bold text-text">{appt.title}</Text>
          <View className="flex-row items-center gap-1">
            <Text className="text-sm text-muted">
              {formatDate(appt.date)} · {appt.time}
            </Text>
            {appt.reminder !== "none" ? (
              <MaterialCommunityIcons name="bell-outline" size={13} color={colors.textMuted} />
            ) : null}
          </View>
        </View>
        <Text className={`text-xs font-bold ${meta.tag}`}>{meta.label}</Text>
      </View>

      {expanded ? (
        <View className="mt-4 gap-2 border-t border-border pt-4">
          {appt.location ? (
            <View className="flex-row items-center gap-1.5">
              <MaterialCommunityIcons name="map-marker-outline" size={15} color={colors.textMuted} />
              <Text className="text-sm text-text">{appt.location}</Text>
            </View>
          ) : null}
          {appt.notes ? <Text className="text-sm text-muted">{appt.notes}</Text> : null}
          <View className="flex-row items-center gap-1.5">
            <MaterialCommunityIcons name="bell-outline" size={14} color={colors.textMuted} />
            <Text className="text-sm text-muted">Rappel : {REMINDER_META[appt.reminder].label}</Text>
          </View>

          {isConcours ? (
            <View className="mt-2 gap-2 border-t border-border pt-3">
              <Text className="text-xs font-bold uppercase tracking-wide text-accent">
                Checklist
                {appt.checklist.length > 0
                  ? ` (${appt.checklist.filter((c) => c.checked).length}/${appt.checklist.length} prêt)`
                  : ""}
              </Text>

              {appt.checklist.length > 0 ? (
                <View className="gap-1.5">
                  {appt.checklist.map((item) => (
                    <View key={item.id} className="flex-row items-center gap-2.5 py-1">
                      <TouchableOpacity
                        onPress={() => onToggleChecklistItem(item.id)}
                        activeOpacity={0.7}
                        className="flex-1 flex-row items-center gap-2.5"
                      >
                        <View
                          className={`h-5 w-5 items-center justify-center rounded-full border ${
                            item.checked ? "border-success bg-success" : "border-border"
                          }`}
                        >
                          {item.checked ? <Text className="text-xs text-on-primary">✓</Text> : null}
                        </View>
                        <Text
                          className={`flex-1 text-sm ${item.checked ? "text-muted line-through" : "text-text"}`}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => onRemoveChecklistItem(item.id)}
                        activeOpacity={0.7}
                        hitSlop={8}
                      >
                        <Text className="text-sm text-muted">✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null}

              <View className="mt-1 flex-row items-center gap-2">
                <TextInput
                  className="flex-1 rounded-card border border-border bg-surface px-3 py-2.5 text-sm text-text"
                  placeholder="Ajouter un élément…"
                  value={newItemLabel}
                  onChangeText={setNewItemLabel}
                  onSubmitEditing={handleAddChecklistItem}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  onPress={handleAddChecklistItem}
                  disabled={!newItemLabel.trim()}
                  activeOpacity={0.8}
                  className={`h-9 w-9 items-center justify-center rounded-full ${
                    newItemLabel.trim() ? "bg-primary" : "bg-border"
                  }`}
                >
                  <Text className={`text-base font-bold ${newItemLabel.trim() ? "text-on-primary" : "text-muted"}`}>
                    +
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {isConcours ? (
            <View className="mt-2 gap-2 border-t border-border pt-3">
              {appt.dossard ? <Text className="text-sm text-text">N° dossard {appt.dossard}</Text> : null}
              <Text className="text-xs font-bold uppercase tracking-wide text-accent">Épreuves</Text>
              {appt.competitionEntries.length > 0 ? (
                <View className="gap-2">
                  {appt.competitionEntries.map((entry) => (
                    <CompetitionEntryRow
                      key={entry.id}
                      entry={entry}
                      isPast={isPastConcours}
                      onSaveResult={(result) => onUpdateCompetitionEntryResult(entry.id, result)}
                      onDelete={() => onDeleteCompetitionEntry(entry.id)}
                    />
                  ))}
                </View>
              ) : (
                <Text className="text-sm text-muted">Aucune épreuve renseignée.</Text>
              )}
              <Locked message="Plusieurs épreuves par concours réservé à l'abonnement Premium">
                <AddCompetitionEntryForm onAdd={onAddCompetitionEntry} />
              </Locked>
            </View>
          ) : null}

          {isPastConcours ? (
            <View className="mt-2 gap-2 border-t border-border pt-3">
              {editingResult ? (
                <>
                  <Text className="text-xs font-bold uppercase tracking-wide text-accent">
                    Résultat de l&apos;épreuve
                  </Text>
                  <TextInput
                    className={INPUT}
                    placeholder="Ex : 3ème, parcours sans faute"
                    value={draftResult}
                    onChangeText={setDraftResult}
                    multiline
                  />
                  <TouchableOpacity
                    onPress={handleSaveResult}
                    disabled={!draftResult.trim()}
                    activeOpacity={0.85}
                    className={`items-center rounded-full p-3 ${draftResult.trim() ? "bg-primary" : "border border-border"}`}
                  >
                    <Text className={`text-sm font-bold ${draftResult.trim() ? "text-on-primary" : "text-muted"}`}>
                      Enregistrer
                    </Text>
                  </TouchableOpacity>
                </>
              ) : appt.result ? (
                <TouchableOpacity onPress={() => setEditingResult(true)} activeOpacity={0.7} className="gap-1">
                  <Text className="text-xs font-bold uppercase tracking-wide text-accent">Résultat</Text>
                  <Text className="text-sm text-text">{appt.result}</Text>
                  <Text className="text-xs font-semibold text-accent">Modifier</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => setEditingResult(true)} activeOpacity={0.7}>
                  <Text className="text-sm font-semibold text-accent">+ Ajouter le résultat</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          <TouchableOpacity onPress={onDelete} activeOpacity={0.7} className="mt-1">
            <Text className="text-sm font-semibold text-danger">Supprimer ce rendez-vous</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function CompetitionEntryRow({
  entry,
  isPast,
  onSaveResult,
  onDelete,
}: {
  entry: CompetitionEntry;
  isPast: boolean;
  onSaveResult: (result: string) => void;
  onDelete: () => void;
}) {
  const [editingResult, setEditingResult] = useState(false);
  const [draftResult, setDraftResult] = useState(entry.result ?? "");
  const meta = DISCIPLINE_META[entry.discipline];

  function handleSave() {
    if (!draftResult.trim()) return;
    onSaveResult(draftResult.trim());
    setEditingResult(false);
  }

  return (
    <View className="gap-1.5 rounded-card border border-border p-3">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-semibold text-text">{entry.name}</Text>
          <View className="flex-row items-center gap-1">
            <MaterialCommunityIcons name={meta.icon.name} size={12} color={meta.icon.color} />
            <Text className="text-xs text-muted">
              {meta.label} · {entry.time}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onDelete} hitSlop={8} activeOpacity={0.7}>
          <Text className="text-sm text-muted">✕</Text>
        </TouchableOpacity>
      </View>

      {isPast ? (
        editingResult ? (
          <View className="gap-2">
            <TextInput
              className={INPUT}
              placeholder="Ex : 3ème, parcours sans faute"
              value={draftResult}
              onChangeText={setDraftResult}
              multiline
            />
            <TouchableOpacity
              onPress={handleSave}
              disabled={!draftResult.trim()}
              activeOpacity={0.85}
              className={`items-center rounded-full p-2.5 ${draftResult.trim() ? "bg-primary" : "border border-border"}`}
            >
              <Text className={`text-sm font-bold ${draftResult.trim() ? "text-on-primary" : "text-muted"}`}>
                Enregistrer
              </Text>
            </TouchableOpacity>
          </View>
        ) : entry.result ? (
          <TouchableOpacity onPress={() => setEditingResult(true)} activeOpacity={0.7} className="gap-0.5">
            <Text className="text-xs font-bold uppercase tracking-wide text-accent">Résultat</Text>
            <Text className="text-sm text-text">{entry.result}</Text>
            <Text className="text-xs font-semibold text-accent">Modifier</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setEditingResult(true)} activeOpacity={0.7}>
            <Text className="text-sm font-semibold text-accent">+ Ajouter le résultat</Text>
          </TouchableOpacity>
        )
      ) : null}
    </View>
  );
}

function AddCompetitionEntryForm({ onAdd }: { onAdd: (entry: Omit<CompetitionEntry, "id" | "result">) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [discipline, setDiscipline] = useState<Discipline>("SHOW_JUMPING");
  const [time, setTime] = useState("");

  function handleAdd() {
    if (!name.trim() || !time.trim()) return;
    onAdd({ name: name.trim(), discipline, time: time.trim() });
    setName("");
    setDiscipline("SHOW_JUMPING");
    setTime("");
    setOpen(false);
  }

  if (!open) {
    return (
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-border p-2.5"
      >
        <Text className="text-sm font-semibold text-accent">＋ Ajouter une épreuve</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View className="gap-2 rounded-card border border-border p-3">
      <TextInput
        className={INPUT}
        placeholder="Ex : Épreuve club 2 — 1m10"
        value={name}
        onChangeText={setName}
      />
      <ChipSelect
        options={Object.entries(DISCIPLINE_META).map(([value, meta]) => ({
          value: value as Discipline,
          label: meta.label,
          icon: meta.icon,
        }))}
        value={discipline}
        onChange={setDiscipline}
      />
      <TextInput className={INPUT} placeholder="Heure de l'épreuve (ex : 09h15)" value={time} onChangeText={setTime} />
      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={() => setOpen(false)}
          activeOpacity={0.8}
          className="flex-1 items-center rounded-card border border-border p-2.5"
        >
          <Text className="text-sm font-semibold text-muted">Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleAdd}
          disabled={!name.trim() || !time.trim()}
          activeOpacity={0.85}
          className={`flex-1 items-center rounded-card p-2.5 ${name.trim() && time.trim() ? "bg-primary" : "border border-border"}`}
        >
          <Text className={`text-sm font-bold ${name.trim() && time.trim() ? "text-on-primary" : "text-muted"}`}>
            Ajouter
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DocumentCard({
  doc,
  expanded,
  onToggleExpand,
  onDelete,
}: {
  doc: Doc;
  expanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
}) {
  const meta = DOC_META[doc.category];
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onToggleExpand} className={CARD}>
      <View className="flex-row items-center gap-3">
        <View className={`h-11 w-11 items-center justify-center rounded-full ${meta.chip}`}>
          <MaterialCommunityIcons name={meta.icon.name} size={20} color={meta.icon.color} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-bold text-text">{doc.name}</Text>
          <Text className="text-sm text-muted">{formatDate(doc.date)}</Text>
        </View>
        <Text className={`text-xs font-bold ${meta.tag}`}>{meta.label}</Text>
      </View>

      {expanded ? (
        <View className="mt-4 gap-2 border-t border-border pt-4">
          {doc.fileUri ? (
            <Image source={{ uri: doc.fileUri }} className="h-40 w-full rounded-card" resizeMode="cover" />
          ) : (
            <View className="flex-row items-center gap-1.5">
              <MaterialCommunityIcons name="paperclip" size={15} color={colors.textMuted} />
              <Text className="text-sm text-muted">Aucun fichier joint</Text>
            </View>
          )}
          <TouchableOpacity onPress={onDelete} activeOpacity={0.7} className="mt-1">
            <Text className="text-sm font-semibold text-danger">Supprimer ce document</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function JournalCard({
  entry,
  expanded,
  onToggleExpand,
  onDelete,
}: {
  entry: JournalEntry;
  expanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
}) {
  const meta = ACTIVITY_META[entry.activityType];
  const mood = MOOD_META[entry.mood];
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onToggleExpand} className={CARD}>
      <View className="flex-row items-center gap-3">
        <View className={`h-11 w-11 items-center justify-center rounded-full ${meta.chip}`}>
          <MaterialCommunityIcons name={meta.icon} size={20} color={meta.tint} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-bold text-text">{meta.label}</Text>
          <Text className="text-sm text-muted">
            {formatDate(entry.date)} · {entry.time}
            {entry.weather ? ` · ${entry.weather.icon} ${Math.round(entry.weather.tempC)}°C` : ""}
          </Text>
        </View>
        <Text className="text-lg">{mood.emoji}</Text>
      </View>

      {expanded ? (
        <View className="mt-4 gap-2 border-t border-border pt-4">
          <Text className="text-sm text-text">{mood.emoji} Ressenti : {mood.label}</Text>
          {entry.weather ? (
            <Text className="text-sm text-text">
              {entry.weather.icon} {entry.weather.label} · {Math.round(entry.weather.tempC)}°C
            </Text>
          ) : null}
          {entry.notes ? <Text className="text-sm text-muted">{entry.notes}</Text> : null}
          <TouchableOpacity onPress={onDelete} activeOpacity={0.7} className="mt-1">
            <Text className="text-sm font-semibold text-danger">Supprimer cette entrée</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function ExpenseCard({
  expense,
  linkedAppointment,
  linkedDocument,
  onDelete,
  onTogglePaid,
}: {
  expense: Expense;
  linkedAppointment: Appointment | null;
  linkedDocument: Doc | null;
  onDelete: () => void;
  onTogglePaid: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = EXPENSE_META[expense.category];
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => setExpanded((v) => !v)} className={CARD}>
      <View className="flex-row items-center gap-3">
        <View className={`h-11 w-11 items-center justify-center rounded-full ${meta.chip}`}>
          <MaterialCommunityIcons name={meta.icon.name} size={20} color={meta.icon.color} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-bold text-text">{meta.label}</Text>
          <Text className="text-sm text-muted">{formatDate(expense.date)}</Text>
        </View>
        <View className="items-end gap-0.5">
          <Text className="text-base font-extrabold text-text">{formatAmount(expense.amount, expense.currency)}</Text>
          <Text className={`text-xs font-semibold ${expense.isPaid ? "text-success" : "text-muted"}`}>
            {expense.isPaid ? "Payé" : "À régler"}
          </Text>
        </View>
      </View>

      {expanded ? (
        <View className="mt-4 gap-2 border-t border-border pt-4">
          {expense.notes ? <Text className="text-sm text-muted">{expense.notes}</Text> : null}
          {linkedAppointment ? (
            <View className="flex-row items-center gap-1.5">
              <MaterialCommunityIcons name="link-variant" size={15} color={colors.textMuted} />
              <Text className="text-sm text-text">
                Lié à {linkedAppointment.title} ({formatDate(linkedAppointment.date)})
              </Text>
            </View>
          ) : null}
          {expense.documentId ? (
            linkedDocument ? (
              <View className="flex-row items-center gap-1.5">
                <MaterialCommunityIcons name="receipt" size={15} color={colors.textMuted} />
                <Text className="text-sm text-text">Reçu : {linkedDocument.name}</Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-1.5">
                <MaterialCommunityIcons name="lock-outline" size={15} color={colors.textMuted} />
                <Text className="text-sm text-muted">Reçu non disponible</Text>
              </View>
            )
          ) : null}
          <Locked message="Basculer le statut payé/à régler réservé à l'abonnement Premium">
            <TouchableOpacity onPress={onTogglePaid} activeOpacity={0.7} className="mt-1">
              <Text className="text-sm font-semibold text-accent">
                {expense.isPaid ? "Marquer à régler" : "Marquer payée"}
              </Text>
            </TouchableOpacity>
          </Locked>
          <TouchableOpacity onPress={onDelete} activeOpacity={0.7} className="mt-1">
            <Text className="text-sm font-semibold text-danger">Supprimer cette dépense</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
