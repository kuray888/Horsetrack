import { useState } from "react";
import { formatDate } from "@/lib/dateFormat";
import {
  cancelReminder,
  computeReminderTrigger,
  scheduleReminder,
  type ReminderOption,
} from "@/lib/notifications";
import { cancelEmailReminder, scheduleEmailReminder } from "@/lib/emailReminders";
import type { Horse } from "@/horses/store";
import {
  defaultChecklist,
  useAgenda,
  type Appointment,
  type AppointmentType,
  type CompetitionEntry,
} from "@/agenda/store";
import { APPT_META, newDraftEntryId } from "@/agenda/meta";

const emptyApptForm = {
  type: "veto" as AppointmentType,
  title: "",
  date: null as Date | null,
  time: "09h00",
  location: "",
  reminder: "1d" as ReminderOption,
  dossard: "",
  competitionEntries: [] as CompetitionEntry[],
  professional: "",
  cost: "",
  nextDueDate: null as Date | null,
  // Répétition simple, même mécanique que les séances (cf.
  // planning.tsx/emptyForm) : N occurrences hebdomadaires indépendantes,
  // aucune notion de "série" côté modèle. Ignoré en édition.
  repeatWeeks: 1,
};

export type AppointmentFormValue = typeof emptyApptForm;

type AgendaActions = ReturnType<typeof useAgenda>;

/** État + logique du formulaire de rendez-vous (création/édition) d'AgendaScreen
 * — extrait tel quel, aucun changement de comportement (cf. plan Phase 3
 * Étape 1). `onEditStart` reproduit l'effet de bord que `startEditAppt`
 * faisait déjà (fermer la carte dépliée avant d'ouvrir le formulaire). */
export function useAppointmentForm({
  horse,
  appointments,
  addAppointment,
  updateAppointment,
  isActiveOrTrialing,
  setNotifPermission,
  onEditStart,
}: {
  horse: Horse | null;
  appointments: Appointment[];
  addAppointment: AgendaActions["addAppointment"];
  updateAppointment: AgendaActions["updateAppointment"];
  isActiveOrTrialing: boolean;
  setNotifPermission: (value: boolean | null | ((prev: boolean | null) => boolean | null)) => void;
  onEditStart: () => void;
}) {
  const [showApptForm, setShowApptForm] = useState(false);
  const [apptForm, setApptForm] = useState(emptyApptForm);
  const [submittingAppt, setSubmittingAppt] = useState(false);
  // Non-null pendant l'édition d'un rendez-vous existant (cf. startEditAppt) —
  // réutilise le même formulaire/état que la création (apptForm), distingue
  // juste l'action à effectuer à la soumission (cf. handleSubmitAppointment).
  const [editingApptId, setEditingApptId] = useState<string | null>(null);

  function startEditAppt(appt: Appointment) {
    setEditingApptId(appt.id);
    setApptForm({
      type: appt.type,
      title: appt.title,
      date: appt.date,
      time: appt.time,
      location: appt.location,
      reminder: appt.reminder,
      dossard: appt.dossard ?? "",
      competitionEntries: appt.competitionEntries,
      professional: appt.professional ?? "",
      cost: appt.cost !== null ? String(appt.cost).replace(".", ",") : "",
      nextDueDate: appt.nextDueDate,
      repeatWeeks: 1,
    });
    onEditStart();
    setShowApptForm(true);
  }

  function cancelApptForm() {
    setShowApptForm(false);
    setEditingApptId(null);
    setApptForm(emptyApptForm);
  }

  /** Programme le rappel (push + email) pour la date/heure/option courantes du
   * formulaire — factorisé entre création et édition (cf. handleSubmitAppointment)
   * : éditer un rendez-vous reprogramme son rappel exactement comme à la
   * création, l'ancien étant annulé juste avant côté appelant. */
  async function scheduleApptReminder(
    title: string,
    date: Date,
    time: string,
    location: string,
    reminder: ReminderOption
  ): Promise<{ reminderNotificationId: string | null; emailReminderId: string | null }> {
    const trigger = computeReminderTrigger(date, time, reminder);
    const notifBody = `${formatDate(date)}${time ? ` à ${time}` : ""}${location ? ` · ${location}` : ""}`;
    if (!trigger) return { reminderNotificationId: null, emailReminderId: null };
    // L'échec de programmation du rappel (permission révoquée, erreur OS) ne
    // doit jamais empêcher l'ajout/l'édition du rendez-vous lui-même.
    let reminderNotificationId: string | null = null;
    try {
      reminderNotificationId = await scheduleReminder(`Rappel : ${title}`, notifBody, trigger);
    } catch {
      reminderNotificationId = null;
    }
    setNotifPermission((prev) => (!reminderNotificationId ? false : prev));
    const emailReminderId = await scheduleEmailReminder(trigger, `Rappel : ${title}`, notifBody);
    return { reminderNotificationId, emailReminderId };
  }

  /** Rappel de la prochaine échéance de soin (ex: prochain vaccin) — 3 jours
   * avant à 9h, fixe et non configurable (cf. principe "reste simple" du
   * suivi santé). Fonctionnalité Premium comme le rappel de rendez-vous
   * ci-dessus, mais la date elle-même reste saisissable/affichée en gratuit :
   * seule la notification automatique est une valeur ajoutée Premium. */
  async function scheduleNextDueReminder(
    apptType: AppointmentType,
    title: string,
    nextDueDate: Date
  ): Promise<string | null> {
    if (!isActiveOrTrialing) return null;
    const trigger = new Date(nextDueDate);
    trigger.setDate(trigger.getDate() - 3);
    trigger.setHours(9, 0, 0, 0);
    if (trigger.getTime() <= Date.now()) return null;
    try {
      return await scheduleReminder(
        `Échéance à venir : ${title}`,
        `${APPT_META[apptType].label} prévu(e) le ${formatDate(nextDueDate)} pour ${horse?.name ?? "ton cheval"}.`,
        trigger
      );
    } catch {
      return null;
    }
  }

  async function handleSubmitAppointment() {
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
    const isConcours = apptForm.type === "concours";
    const professional = apptForm.professional.trim() || null;
    const parsedCost = Number(apptForm.cost.replace(",", "."));
    const cost = apptForm.cost.trim() && Number.isFinite(parsedCost) && parsedCost > 0 ? parsedCost : null;
    const nextDueDate = apptForm.nextDueDate;

    try {
      const editing = editingApptId ? appointments.find((a) => a.id === editingApptId) : null;
      if (editing) {
        // Annule les anciens rappels avant d'en reprogrammer de nouveaux —
        // sinon un changement de date laisserait le rappel se déclencher à
        // l'ancienne heure EN PLUS du nouveau (cf. deleteAppointment, même
        // paire d'appels).
        cancelReminder(editing.reminderNotificationId);
        cancelEmailReminder(editing.emailReminderId);
        cancelReminder(editing.nextDueNotificationId);
        const { reminderNotificationId, emailReminderId } = await scheduleApptReminder(
          title,
          date,
          time,
          location,
          reminder
        );
        const nextDueNotificationId = nextDueDate
          ? await scheduleNextDueReminder(apptForm.type, title, nextDueDate)
          : null;
        updateAppointment(editing.id, {
          type: apptForm.type,
          title,
          date,
          time,
          location,
          reminder,
          reminderNotificationId,
          emailReminderId,
          dossard: isConcours ? apptForm.dossard.trim() || null : null,
          professional,
          cost,
          nextDueDate,
          nextDueNotificationId,
        });
      } else {
        // repeatWeeks > 1 : crée un rendez-vous identique chaque semaine sur
        // N semaines (ex: "4 semaines" => 4 rendez-vous au total, celui-ci
        // inclus) — même mécanique simple que les séances (cf.
        // planning.tsx handleSubmit) : pas de notion de "série" côté modèle,
        // chaque occurrence est un Appointment indépendant.
        const repeatWeeks = Math.max(1, apptForm.repeatWeeks);
        for (let i = 0; i < repeatWeeks; i++) {
          const occurrenceDate = new Date(date);
          occurrenceDate.setDate(occurrenceDate.getDate() + i * 7);
          const { reminderNotificationId, emailReminderId } = await scheduleApptReminder(
            title,
            occurrenceDate,
            time,
            location,
            reminder
          );
          // La prochaine échéance de soin ne s'applique qu'à la première
          // occurrence — la dupliquer sur chaque semaine répétée n'aurait pas
          // de sens (et programmerait le même rappel plusieurs fois).
          const occurrenceNextDueDate = i === 0 ? nextDueDate : null;
          const nextDueNotificationId = occurrenceNextDueDate
            ? await scheduleNextDueReminder(apptForm.type, title, occurrenceNextDueDate)
            : null;
          addAppointment({
            type: apptForm.type,
            title,
            date: occurrenceDate,
            time,
            location,
            notes: "",
            reminder,
            reminderNotificationId,
            emailReminderId,
            professional,
            cost,
            nextDueDate: occurrenceNextDueDate,
            nextDueNotificationId,
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
        }
      }
      cancelApptForm();
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

  return {
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
  };
}
