import { useState } from "react";
import { Alert } from "react-native";
import { formatDate } from "@/lib/dateFormat";
import {
  cancelReminder,
  computeReminderTrigger,
  scheduleReminder,
  type ReminderOption,
} from "@/lib/notifications";
import { cancelEmailReminder, scheduleEmailReminder } from "@/lib/emailReminders";
import { NEVER_RECURRENCE, computeRecurrenceDates, type Recurrence } from "@/lib/recurrence";
import type { Horse } from "@/horses/store";
import {
  hiddenTargetsMessage,
  MAX_ENTRIES_PER_SUBMIT,
  resolveTargetHorseIds,
  shouldOfferHorseChoice,
  targetsOutsideView,
} from "@/horses/selectableHorses";
import { amountsForHorses, type AmountMode } from "@/agenda/splitAmount";
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
  // Récurrence partagée avec les séances (cf. src/lib/recurrence.ts) :
  // occurrences indépendantes, aucune notion de "série" côté modèle. Ignorée
  // en édition, et masquée/forcée à "never" pour un concours (cf.
  // handleSubmitAppointment) — cf. AppointmentForm.tsx pour l'UI.
  recurrence: NEVER_RECURRENCE as Recurrence,
  /** Chevaux visés par la création, quand l'écran propose le choix (cf.
   * `selectableHorses` passé au hook, et HorseMultiSelect côté UI). Un
   * tableau VIDE signifie « aucun choix explicite » — donc le cheval actif,
   * exactement comme avant : tous les écrans qui n'affichent pas le
   * sélecteur gardent ainsi leur comportement d'origine sans rien changer
   * chez eux (cf. resolveTargetHorseIds). Ignoré en édition : on ne
   * réaffecte jamais un rendez-vous existant à un autre cheval, chaque
   * entrée créée est une copie indépendante (même principe que la
   * récurrence ci-dessus). */
  horseIds: [] as string[],
  /** Comment lire `cost` quand plusieurs chevaux sont visés — même choix que
   * pour une dépense (cf. AmountModeField). Sans effet sur un seul cheval. */
  costMode: "per-horse" as AmountMode,
};

export type AppointmentFormValue = typeof emptyApptForm;

type AgendaActions = ReturnType<typeof useAgenda>;

/** État + logique du formulaire de rendez-vous (création/édition) d'AgendaScreen
 * — extrait tel quel, aucun changement de comportement (cf. plan Phase 3
 * Étape 1). `onEditStart` reproduit l'effet de bord que `startEditAppt`
 * faisait déjà (fermer la carte dépliée avant d'ouvrir le formulaire). */
export function useAppointmentForm({
  horse,
  selectableHorses = [],
  defaultHorseIds,
  appointments,
  addAppointment,
  updateAppointment,
  isActiveOrTrialing,
  setNotifPermission,
  onEditStart,
}: {
  horse: Horse | null;
  /** Chevaux proposables à la création, quand l'écran veut offrir le choix
   * « pour quel(s) cheval(aux) ? » (cf. useSelectableHorses). Laissé vide par
   * les écrans déjà cadrés sur un seul cheval — fiche cheval, santé d'un
   * cheval — où proposer d'en viser un autre n'aurait aucun sens. */
  selectableHorses?: Horse[];
  /** Chevaux visés tant que l'utilisateur n'a rien coché. Omis : le cheval
   * `horse`, comme avant. Le Planning y passe tous les chevaux proposables
   * quand sa puce « Tous » est posée. */
  defaultHorseIds?: string[];
  appointments: Appointment[];
  addAppointment: AgendaActions["addAppointment"];
  updateAppointment: AgendaActions["updateAppointment"];
  isActiveOrTrialing: boolean;
  setNotifPermission: (value: boolean | null | ((prev: boolean | null) => boolean | null)) => void;
  onEditStart: () => void;
}) {
  // Rappel par défaut "aucun" en gratuit : le champ reste verrouillé (cf.
  // AppointmentForm.tsx, <Locked>) et handleSubmitAppointment force de toute
  // façon "none" à la soumission pour un compte non Premium (cf. plus bas) —
  // afficher "1 jour avant" pré-sélectionné sous le cadenas laissait croire
  // qu'un rappel serait programmé, cf. audit pré-publication.
  function initialApptForm(): AppointmentFormValue {
    return { ...emptyApptForm, reminder: isActiveOrTrialing ? "1d" : "none" };
  }

  const [showApptForm, setShowApptForm] = useState(false);
  const [apptForm, setApptForm] = useState<AppointmentFormValue>(initialApptForm);
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
      recurrence: NEVER_RECURRENCE,
      horseIds: [],
      costMode: "per-horse",
    });
    onEditStart();
    setShowApptForm(true);
  }

  function cancelApptForm() {
    setShowApptForm(false);
    setEditingApptId(null);
    setApptForm(initialApptForm());
  }

  /** Programme le rappel (push + email) pour la date/heure/option courantes du
   * formulaire — factorisé entre création et édition (cf. handleSubmitAppointment)
   * : éditer un rendez-vous reprogramme son rappel exactement comme à la
   * création, l'ancien étant annulé juste avant côté appelant.
   *
   * `horseName` ouvre le corps de la notification depuis le 2026-09-19 : un
   * même rendez-vous créé pour plusieurs chevaux produit autant de rappels à
   * la même minute, et sans le nom ils étaient strictement indiscernables
   * (le titre ne porte que l'intitulé saisi, ex. « Rappel : Vaccin »). Ajouté
   * inconditionnellement plutôt que seulement en multi-chevaux : deux
   * formats de notification selon l'état du compte au moment de la
   * programmation coûteraient plus cher à comprendre que ce mot en tête. */
  async function scheduleApptReminder(
    title: string,
    date: Date,
    time: string,
    location: string,
    reminder: ReminderOption,
    horseName: string | null
  ): Promise<{ reminderNotificationId: string | null; emailReminderId: string | null }> {
    const trigger = computeReminderTrigger(date, time, reminder);
    const notifBody = `${horseName ? `${horseName} · ` : ""}${formatDate(date)}${time ? ` à ${time}` : ""}${location ? ` · ${location}` : ""}`;
    if (!trigger) return { reminderNotificationId: null, emailReminderId: null };
    // L'échec de programmation du rappel (permission révoquée, erreur OS) ne
    // doit jamais empêcher l'ajout/l'édition du rendez-vous lui-même. Push et
    // e-mail sont indépendants : lancés ensemble plutôt qu'à la suite, ce qui
    // divise à peu près par deux le temps d'une création pour plusieurs chevaux
    // (un appel réseau par entrée).
    const pushPromise = scheduleReminder(`Rappel : ${title}`, notifBody, trigger).catch(() => null);
    const [reminderNotificationId, emailReminderId] = await Promise.all([
      pushPromise,
      scheduleEmailReminder(trigger, `Rappel : ${title}`, notifBody),
    ]);
    setNotifPermission((prev) => (!reminderNotificationId ? false : prev));
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
    nextDueDate: Date,
    horseName: string | null
  ): Promise<string | null> {
    if (!isActiveOrTrialing) return null;
    const trigger = new Date(nextDueDate);
    trigger.setDate(trigger.getDate() - 3);
    trigger.setHours(9, 0, 0, 0);
    if (trigger.getTime() <= Date.now()) return null;
    try {
      return await scheduleReminder(
        `Échéance à venir : ${title}`,
        `${APPT_META[apptType].label} prévu(e) le ${formatDate(nextDueDate)} pour ${horseName ?? "ton cheval"}.`,
        trigger
      );
    } catch {
      return null;
    }
  }

  /** Nom à afficher dans un rappel pour un cheval donné. Cherche d'abord
   * parmi les chevaux proposables (cas multi-chevaux), puis le cheval actif.
   * `null` si introuvable — le corps du rappel repart alors sans nom, comme
   * avant l'ajout de ce champ, plutôt que d'afficher un identifiant. */
  function horseNameFor(horseId: string | null): string | null {
    if (!horseId) return null;
    if (horse?.id === horseId) return horse.name;
    return selectableHorses.find((h) => h.id === horseId)?.name ?? null;
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
    let hiddenNames: string[] = [];

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
        const editingHorseName = horseNameFor(editing.horseId);
        const { reminderNotificationId, emailReminderId } = await scheduleApptReminder(
          title,
          date,
          time,
          location,
          reminder,
          editingHorseName
        );
        const nextDueNotificationId = nextDueDate
          ? await scheduleNextDueReminder(apptForm.type, title, nextDueDate, editingHorseName)
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
        // La récurrence est masquée pour un concours côté UI (cf.
        // AppointmentForm.tsx) ; on l'ignore aussi ici par sécurité si le
        // formulaire gardait une valeur "custom" d'un type précédent avant
        // que l'utilisateur ne bascule sur "concours".
        const recurrence: Recurrence = isConcours ? NEVER_RECURRENCE : apptForm.recurrence;
        const occurrenceDates = computeRecurrenceDates(date, recurrence);
        // Deux boucles imbriquées, chevaux × dates : le même rendez-vous
        // répété dans le temps ET étalé sur plusieurs chevaux. Chaque tour
        // produit une entrée COMPLÈTE et INDÉPENDANTE — il n'existe aucun
        // identifiant de série côté modèle (cf. commentaire du champ
        // `recurrence` plus haut), et la décision produit du 2026-09-19 est
        // de garder cet invariant : modifier ou supprimer une entrée ne
        // touche qu'elle, l'utilisateur désignant le cheval voulu via la
        // pastille de nom du Planning (cf. vue « Tous les chevaux »).
        const fallbackIds = defaultHorseIds ?? [horse.id];
        // Un concours reste cadré sur UN cheval, quoi qu'affiche le sélecteur
        // (masqué pour ce type, cf. AppointmentForm) : le dossard et les
        // épreuves sont propres à chaque cheval, et les épreuves vivent dans
        // leur propre table serveur, clé = leur id — les recopier sur N
        // rendez-vous les laisserait toutes rattachées au dernier seulement.
        // En vue « Tous », c'est `horse` (le cheval actif ou filtré).
        const targetHorseIds = isConcours
          ? [horse.id]
          : shouldOfferHorseChoice(selectableHorses, fallbackIds)
            ? resolveTargetHorseIds(apptForm.horseIds, selectableHorses, fallbackIds)
            : fallbackIds;
        // Garde-fou du plafond (le formulaire désactive déjà le bouton, cf.
        // AppointmentForm) : une notification locale ET un e-mail par entrée.
        if (targetHorseIds.length * occurrenceDates.length > MAX_ENTRIES_PER_SUBMIT) {
          Alert.alert(
            "Trop de rendez-vous d'un coup",
            `Une création est limitée à ${MAX_ENTRIES_PER_SUBMIT} rendez-vous (chevaux × répétitions). Réduis la répétition ou le nombre de chevaux.`
          );
          return;
        }
        // Coût : par cheval (chacun le même montant) ou à répartir entre eux,
        // au centime (cf. splitAmount) — même choix que pour une dépense.
        const costs = cost === null ? [] : amountsForHorses(cost, targetHorseIds.length, apptForm.costMode);
        for (let horseIndex = 0; horseIndex < targetHorseIds.length; horseIndex++) {
          const targetHorseId = targetHorseIds[horseIndex];
          const targetHorseName = horseNameFor(targetHorseId);
          const horseCost = cost === null ? null : (costs[horseIndex] ?? cost);
          for (let i = 0; i < occurrenceDates.length; i++) {
            const occurrenceDate = occurrenceDates[i];
            const { reminderNotificationId, emailReminderId } = await scheduleApptReminder(
              title,
              occurrenceDate,
              time,
              location,
              reminder,
              targetHorseName
            );
            // La prochaine échéance de soin ne s'applique qu'à la première
            // occurrence — la dupliquer sur chaque semaine répétée n'aurait pas
            // de sens (et programmerait le même rappel plusieurs fois). Elle
            // vaut en revanche pour CHAQUE cheval : le prochain vaccin de l'un
            // ne dit rien de celui de l'autre.
            const occurrenceNextDueDate = i === 0 ? nextDueDate : null;
            const nextDueNotificationId = occurrenceNextDueDate
              ? await scheduleNextDueReminder(apptForm.type, title, occurrenceNextDueDate, targetHorseName)
              : null;
            addAppointment({
              horseId: targetHorseId,
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
              cost: horseCost,
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
        // Un rendez-vous créé pour un cheval que la liste de cet écran
        // n'affiche pas semblerait perdu : on le dit (cf. hiddenTargetsMessage).
        hiddenNames = targetsOutsideView(targetHorseIds, fallbackIds).map(
          (id) => horseNameFor(id) ?? "un autre cheval"
        );
      }
      cancelApptForm();
    } finally {
      setSubmittingAppt(false);
    }
    if (hiddenNames.length > 0) Alert.alert("Rendez-vous enregistré", hiddenTargetsMessage(hiddenNames));
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
