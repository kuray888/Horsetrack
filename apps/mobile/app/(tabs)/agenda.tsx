import { useEffect, useState } from "react";
import { Image, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { Field } from "@/components/Field";
import { DatePickerField } from "@/components/DatePickerField";
import { TimePickerField } from "@/components/TimePickerField";
import { PrimaryButton } from "@/components/onboarding";
import { formatDate } from "@/lib/dateFormat";
import { computeReminderTrigger, ensureNotificationPermission, scheduleReminder, type ReminderOption } from "@/lib/notifications";
import { pickAndPersistImage } from "@/lib/imagePicker";
import { useHorses } from "@/horses/store";
import {
  useAgenda,
  daysFromNow,
  defaultChecklist,
  type Appointment,
  type AppointmentType,
  type Doc,
  type DocumentCategory,
} from "@/agenda/store";

const APPT_META: Record<AppointmentType, { label: string; icon: string; chip: string; tag: string }> = {
  veto: { label: "Vétérinaire", icon: "💉", chip: "bg-warning/15", tag: "text-warning" },
  osteo: { label: "Ostéopathe", icon: "🦴", chip: "bg-accent/15", tag: "text-accent" },
  marechal: { label: "Maréchal-ferrant", icon: "🔨", chip: "bg-primary/15", tag: "text-primary" },
  dentiste: { label: "Dentiste équin", icon: "🦷", chip: "bg-success/15", tag: "text-success" },
  concours: { label: "Concours", icon: "🏆", chip: "bg-accent/15", tag: "text-accent" },
  autre: { label: "Autre", icon: "📌", chip: "bg-border", tag: "text-muted" },
};

const DOC_META: Record<DocumentCategory, { label: string; icon: string; chip: string; tag: string }> = {
  facture: { label: "Facture", icon: "🧾", chip: "bg-primary/15", tag: "text-primary" },
  rapport: { label: "Rapport", icon: "📋", chip: "bg-accent/15", tag: "text-accent" },
  ordonnance: { label: "Ordonnance", icon: "💊", chip: "bg-warning/15", tag: "text-warning" },
  autre: { label: "Autre", icon: "📎", chip: "bg-border", tag: "text-muted" },
};

const REMINDER_META: Record<ReminderOption, { label: string; icon: string }> = {
  none: { label: "Aucun", icon: "🔕" },
  "1h": { label: "1 heure avant", icon: "🔔" },
  "1d": { label: "1 jour avant", icon: "🔔" },
  "1w": { label: "1 semaine avant", icon: "🔔" },
};

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

function ChipSelect<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon: string }[];
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
            className={`flex-row items-center gap-1.5 rounded-full border px-3.5 py-2 ${
              selected ? "border-primary bg-highlight" : "border-border bg-surface"
            }`}
          >
            <Text className="text-sm">{opt.icon}</Text>
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
      <Text className="text-lg font-bold text-primary">＋</Text>
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
};
const emptyDocForm = {
  category: "facture" as DocumentCategory,
  name: "",
  date: null as Date | null,
  fileUri: null as string | null,
};

export default function AgendaScreen() {
  const { selectedHorse: horse } = useHorses();
  const {
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
  } = useAgenda();
  const [section, setSection] = useState<"appointments" | "documents">("appointments");
  const [notifPermission, setNotifPermission] = useState<boolean | null>(null);

  useEffect(() => {
    ensureNotificationPermission().then(setNotifPermission);
  }, []);

  const [showApptForm, setShowApptForm] = useState(false);
  const [apptForm, setApptForm] = useState(emptyApptForm);
  const [expandedApptId, setExpandedApptId] = useState<string | null>(null);
  const [showPastAppts, setShowPastAppts] = useState(false);

  const [showDocForm, setShowDocForm] = useState(false);
  const [docForm, setDocForm] = useState(emptyDocForm);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

  const today = daysFromNow(0);
  const upcomingAppts = appointments.filter((a) => a.date >= today).sort((a, b) => a.date.getTime() - b.date.getTime());
  const pastAppts = appointments.filter((a) => a.date < today).sort((a, b) => b.date.getTime() - a.date.getTime());
  const sortedDocs = [...documents].sort((a, b) => b.date.getTime() - a.date.getTime());

  async function handleAddAppointment() {
    const date = apptForm.date;
    if (!apptForm.title.trim() || !date) return;

    const title = apptForm.title.trim();
    const time = apptForm.time.trim();
    const location = apptForm.location.trim();
    const trigger = computeReminderTrigger(date, time, apptForm.reminder);
    const notifBody = `${formatDate(date)}${time ? ` à ${time}` : ""}${location ? ` · ${location}` : ""}`;
    // L'échec de programmation du rappel (permission révoquée, erreur OS) ne
    // doit jamais empêcher l'ajout du rendez-vous lui-même.
    let reminderNotificationId: string | null = null;
    if (trigger) {
      try {
        reminderNotificationId = await scheduleReminder(`Rappel : ${title}`, notifBody, trigger);
      } catch {
        reminderNotificationId = null;
      }
      setNotifPermission((prev) => (!reminderNotificationId ? false : prev));
    }

    addAppointment({
      type: apptForm.type,
      title,
      date,
      time,
      location,
      notes: "",
      reminder: apptForm.reminder,
      reminderNotificationId,
      checklist: apptForm.type === "concours" ? defaultChecklist() : [],
    });
    setApptForm(emptyApptForm);
    setShowApptForm(false);
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

  return (
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
        </View>
      </FadeInView>

      {notifPermission === false ? (
        <FadeInView delay={120}>
          <View className={`${CARD} flex-row items-center gap-3`}>
            <Text className="text-xl">🔕</Text>
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
                      label="Ajouter"
                      disabled={!apptForm.title.trim() || !apptForm.date}
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
              <View className={`${CARD} items-center gap-1`}>
                <Text className="text-2xl">📭</Text>
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
                  />
                </View>
              </FadeInView>
            ))}
        </>
      ) : (
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
                    <Text className="text-base">📎</Text>
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
              <AddToggle label="Ajouter un document" onPress={() => setShowDocForm(true)} />
            )}
          </FadeInView>

          {sortedDocs.length === 0 ? (
            <FadeInView delay={200}>
              <View className={`${CARD} items-center gap-1`}>
                <Text className="text-2xl">🗂️</Text>
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
      )}
    </Screen>
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
}: {
  appt: Appointment;
  expanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  onSaveResult: (result: string) => void;
  onToggleChecklistItem: (itemId: string) => void;
  onAddChecklistItem: (label: string) => void;
  onRemoveChecklistItem: (itemId: string) => void;
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
          <Text className="text-lg">{meta.icon}</Text>
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-bold text-text">{appt.title}</Text>
          <Text className="text-sm text-muted">
            {formatDate(appt.date)} · {appt.time}
            {appt.reminder !== "none" ? " · 🔔" : ""}
          </Text>
        </View>
        <Text className={`text-xs font-bold ${meta.tag}`}>{meta.label}</Text>
      </View>

      {expanded ? (
        <View className="mt-4 gap-2 border-t border-border pt-4">
          {appt.location ? <Text className="text-sm text-text">📍 {appt.location}</Text> : null}
          {appt.notes ? <Text className="text-sm text-muted">{appt.notes}</Text> : null}
          <Text className="text-sm text-muted">
            🔔 Rappel : {REMINDER_META[appt.reminder].label}
          </Text>

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
                  <Text className="text-xs font-bold uppercase tracking-wide text-accent">🏆 Résultat</Text>
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
          <Text className="text-lg">{meta.icon}</Text>
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
            <Text className="text-sm text-muted">📎 Aucun fichier joint</Text>
          )}
          <TouchableOpacity onPress={onDelete} activeOpacity={0.7} className="mt-1">
            <Text className="text-sm font-semibold text-danger">Supprimer ce document</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
