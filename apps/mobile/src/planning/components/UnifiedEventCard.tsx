import { SessionCard } from "@/sessions/components/SessionCard";
import { AppointmentCard } from "@/agenda/components/AppointmentCard";
import type { Appointment, CompetitionEntry } from "@/agenda/store";
import type { TrainingSession } from "@/sessions/store";
import type { UnifiedEvent } from "@/planning/unifiedEvents";

type SessionHandlers = {
  onToggleDone: (session: TrainingSession) => void;
  onEdit: (session: TrainingSession) => void;
  onDuplicate: (session: TrainingSession) => void;
  onDelete: (session: TrainingSession) => void;
};

type AppointmentHandlers = {
  onEdit: (appt: Appointment) => void;
  onDelete: (appt: Appointment) => void;
  onSaveResult: (appt: Appointment, result: string) => void;
  onToggleChecklistItem: (appt: Appointment, itemId: string) => void;
  onAddChecklistItem: (appt: Appointment, label: string) => void;
  onRemoveChecklistItem: (appt: Appointment, itemId: string) => void;
  onAddCompetitionEntry: (appt: Appointment, entry: Omit<CompetitionEntry, "id" | "result">) => void;
  onUpdateCompetitionEntryResult: (appt: Appointment, entryId: string, result: string) => void;
  onDeleteCompetitionEntry: (appt: Appointment, entryId: string) => void;
};

/** Carte d'événement du Planning unifié (cf. plan Phase 3 Étape 3 §7) — pur
 * dispatcher, aucun rendu propre : délègue à SessionCard ou AppointmentCard
 * selon `event.kind`, chacun conservant son type visuel et ses informations
 * propres (cf. brief §1). Ne réimplémente aucune des deux, ne fusionne pas
 * leurs styles — juste un point d'appel unique pour l'appelant (planning.tsx),
 * qui n'a pas à brancher lui-même sur `event.kind` à chaque rendu de liste. */
export function UnifiedEventCard({
  event,
  expanded,
  onToggleExpand,
  sessionHandlers,
  appointmentHandlers,
}: {
  event: UnifiedEvent;
  expanded: boolean;
  onToggleExpand: () => void;
  sessionHandlers: SessionHandlers;
  appointmentHandlers: AppointmentHandlers;
}) {
  if (event.kind === "session") {
    return (
      <SessionCard
        session={event.session}
        expanded={expanded}
        onPress={onToggleExpand}
        onToggleDone={() => sessionHandlers.onToggleDone(event.session)}
        onEdit={() => sessionHandlers.onEdit(event.session)}
        onDuplicate={() => sessionHandlers.onDuplicate(event.session)}
        onDelete={() => sessionHandlers.onDelete(event.session)}
      />
    );
  }

  const appt = event.appointment;
  return (
    <AppointmentCard
      appt={appt}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      onDelete={() => appointmentHandlers.onDelete(appt)}
      onEdit={() => appointmentHandlers.onEdit(appt)}
      onSaveResult={(result) => appointmentHandlers.onSaveResult(appt, result)}
      onToggleChecklistItem={(itemId) => appointmentHandlers.onToggleChecklistItem(appt, itemId)}
      onAddChecklistItem={(label) => appointmentHandlers.onAddChecklistItem(appt, label)}
      onRemoveChecklistItem={(itemId) => appointmentHandlers.onRemoveChecklistItem(appt, itemId)}
      onAddCompetitionEntry={(entry) => appointmentHandlers.onAddCompetitionEntry(appt, entry)}
      onUpdateCompetitionEntryResult={(entryId, result) =>
        appointmentHandlers.onUpdateCompetitionEntryResult(appt, entryId, result)
      }
      onDeleteCompetitionEntry={(entryId) => appointmentHandlers.onDeleteCompetitionEntry(appt, entryId)}
    />
  );
}
