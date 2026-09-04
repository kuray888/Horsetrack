import { useState } from "react";
import { fetchWeatherSnapshot } from "@/lib/weather";
import { daysFromNow, useAgenda, type ActivityType, type JournalEntry, type Mood } from "@/agenda/store";

const emptyJournalForm = {
  activityType: "dressage" as ActivityType,
  mood: "good" as Mood,
  notes: "",
  date: daysFromNow(0) as Date | null,
  time: "09h00",
};

export type JournalFormValue = typeof emptyJournalForm;

type AgendaActions = ReturnType<typeof useAgenda>;

/** État + logique du formulaire de journal (création/édition) d'AgendaScreen
 * — extrait tel quel, aucun changement de comportement (cf. plan Phase 3
 * Étape 1). `onEditStart` reproduit l'effet de bord que `startEditJournal`
 * faisait déjà (fermer la carte dépliée avant d'ouvrir le formulaire). */
export function useJournalForm({
  addJournalEntry,
  updateJournalEntry,
  onEditStart,
}: {
  addJournalEntry: AgendaActions["addJournalEntry"];
  updateJournalEntry: AgendaActions["updateJournalEntry"];
  onEditStart: () => void;
}) {
  const [showJournalForm, setShowJournalForm] = useState(false);
  const [journalForm, setJournalForm] = useState(emptyJournalForm);
  const [savingJournal, setSavingJournal] = useState(false);
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);

  function startEditJournal(entry: JournalEntry) {
    setEditingJournalId(entry.id);
    setJournalForm({
      activityType: entry.activityType,
      mood: entry.mood,
      notes: entry.notes,
      date: entry.date,
      time: entry.time,
    });
    onEditStart();
    setShowJournalForm(true);
  }

  function cancelJournalForm() {
    setShowJournalForm(false);
    setEditingJournalId(null);
    setJournalForm(emptyJournalForm);
  }

  async function handleSubmitJournalEntry() {
    const date = journalForm.date;
    if (!date) return;
    setSavingJournal(true);
    try {
      if (editingJournalId) {
        // Contrairement à la création, on ne retouche jamais `weather` ici :
        // corriger l'activité/le ressenti d'une entrée passée ne doit pas
        // réécrire un relevé météo qui n'a plus de sens rétroactivement (cf.
        // updateJournalEntry côté store).
        updateJournalEntry(editingJournalId, {
          activityType: journalForm.activityType,
          mood: journalForm.mood,
          notes: journalForm.notes.trim(),
          date,
          time: journalForm.time.trim(),
        });
      } else {
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
      }
      cancelJournalForm();
    } finally {
      setSavingJournal(false);
    }
  }

  return {
    showJournalForm,
    setShowJournalForm,
    journalForm,
    setJournalForm,
    savingJournal,
    editingJournalId,
    startEditJournal,
    cancelJournalForm,
    handleSubmitJournalEntry,
  };
}
