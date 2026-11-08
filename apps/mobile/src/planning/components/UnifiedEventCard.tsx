import { memo } from "react";
import { View } from "react-native";
import { HorseNameBadge } from "@/horses/components/HorseFilterChips";
import { SessionCard } from "@/sessions/components/SessionCard";
import { AppointmentCard } from "@/agenda/components/AppointmentCard";
import type { Appointment, CompetitionEntry } from "@/agenda/store";
import type { TrainingSession } from "@/sessions/store";
import type { UnifiedEvent } from "@/planning/unifiedEvents";
import { animateNextLayout } from "@/lib/motion";
import { SwipeableRow } from "@/components/SwipeableRow";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorseRights } from "@/horses/useHorseRights";
import { useHorseTeam } from "@/horses/team";
import { riderDisplayName, sessionAccess, type TeamMember } from "@/planning/riders";
import { track } from "@/lib/analytics";
import { notifyPlanning } from "@/planning/planningNotify";
import { t } from "@/i18n";

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
  onUpdateCompetitionEntry: (appt: Appointment, entryId: string, patch: Partial<Omit<CompetitionEntry, "id">>) => void;
  onDeleteCompetitionEntry: (appt: Appointment, entryId: string) => void;
};

/** Carte d'événement du Planning unifié (cf. plan Phase 3 Étape 3 §7) — pur
 * dispatcher, aucun rendu propre : délègue à SessionCard ou AppointmentCard
 * selon `event.kind`, chacun conservant son type visuel et ses informations
 * propres (cf. brief §1). Ne réimplémente aucune des deux, ne fusionne pas
 * leurs styles — juste un point d'appel unique pour l'appelant (planning.tsx),
 * qui n'a pas à brancher lui-même sur `event.kind` à chaque rendu de liste. */
export const UnifiedEventCard = memo(function UnifiedEventCard({
  event,
  expanded,
  onToggleExpand,
  sessionHandlers,
  appointmentHandlers,
  horseName = null,
}: {
  event: UnifiedEvent;
  expanded: boolean;
  /** Reçoit l'id de l'événement : une seule fonction stable pour toute la
   * liste, sinon le `memo` de cette carte ne servirait à rien. */
  onToggleExpand: (id: string) => void;
  sessionHandlers: SessionHandlers;
  appointmentHandlers: AppointmentHandlers;
  /** Nom à afficher en pastille au-dessus de la carte — renseigné seulement
   * quand la liste mêle plusieurs chevaux (vue « Tous » du Planning). Rendu
   * ici plutôt que chez l'appelant parce que planning.tsx rend cette carte à
   * trois endroits (jour du mois, à venir, passés) : la pastille serait
   * sinon à écrire, et à maintenir, trois fois. */
  horseName?: string | null;
}) {
  return horseName ? (
    <View className="gap-1.5">
      <HorseNameBadge name={horseName} />
      <EventCard
        event={event}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
        sessionHandlers={sessionHandlers}
        appointmentHandlers={appointmentHandlers}
      />
    </View>
  ) : (
    <EventCard
      event={event}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      sessionHandlers={sessionHandlers}
      appointmentHandlers={appointmentHandlers}
    />
  );
});

function EventCard({
  event,
  expanded,
  onToggleExpand,
  sessionHandlers,
  appointmentHandlers,
}: {
  event: UnifiedEvent;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
  sessionHandlers: SessionHandlers;
  appointmentHandlers: AppointmentHandlers;
}) {
  const colors = useThemeColors();
  // Cheval partagé : actions masquées quand la base les refuserait (cf.
  // lib/permissions.ts) — séance d'un autre cavalier, soin pour une DP…
  const rights = useHorseRights();
  if (event.kind === "session") {
    return (
      <SessionEventCard
        session={event.session}
        expanded={expanded}
        onToggleExpand={() => onToggleExpand(event.id)}
        sessionHandlers={sessionHandlers}
      />
    );
  }
  const appt = event.appointment;
  const readOnly = !rights.appointment(appt);
  return (
    <SwipeableRow
      trailing={readOnly ? null : {
        label: t("Supprimer"),
        icon: "trash-can-outline",
        color: colors.danger,
        onPress: () => appointmentHandlers.onDelete(appt),
      }}
    >
    <AppointmentCard
      appt={appt}
      expanded={expanded}
      onToggleExpand={() => onToggleExpand(event.id)}
      onDelete={() => appointmentHandlers.onDelete(appt)}
      onEdit={() => appointmentHandlers.onEdit(appt)}
      onSaveResult={(result) => appointmentHandlers.onSaveResult(appt, result)}
      onToggleChecklistItem={(itemId) => appointmentHandlers.onToggleChecklistItem(appt, itemId)}
      onAddChecklistItem={(label) => appointmentHandlers.onAddChecklistItem(appt, label)}
      onRemoveChecklistItem={(itemId) => appointmentHandlers.onRemoveChecklistItem(appt, itemId)}
      onAddCompetitionEntry={(entry) => appointmentHandlers.onAddCompetitionEntry(appt, entry)}
      onUpdateCompetitionEntry={(entryId, patch) => appointmentHandlers.onUpdateCompetitionEntry(appt, entryId, patch)}
      onDeleteCompetitionEntry={(entryId) => appointmentHandlers.onDeleteCompetitionEntry(appt, entryId)}
      readOnly={readOnly}
    />
    </SwipeableRow>
  );
}

/** Séance du planning : ce que chacun peut en faire (cf. planning/riders.ts)
 * et qui la monte. Composant à part pour lire l'équipe de SON cheval. */
function SessionEventCard({
  session,
  expanded,
  onToggleExpand,
  sessionHandlers,
}: {
  session: TrainingSession;
  expanded: boolean;
  onToggleExpand: () => void;
  sessionHandlers: SessionHandlers;
}) {
  const colors = useThemeColors();
  const rights = useHorseRights();
  // Équipe lue seulement quand un nom est à afficher (séance attribuée, ou
  // cochée par quelqu'un d'autre).
  const someoneElse = !!session.riderUserId || (!!session.doneByUserId && session.doneByUserId !== rights.me);
  const team = useHorseTeam(someoneElse ? session.horseId : null);
  const done = session.completed;
  const access = sessionAccess(rights.roleFor(session.horseId), session, rights.me);
  const shared = rights.roleFor(session.horseId) !== "OWNER";
  const toggleDone = () => {
    if (access === "done" && !session.completed) track("assigned_session_done", {});
    if (shared && !session.completed) notifyPlanning("session", session.id, "done");
    sessionHandlers.onToggleDone(session);
  };
  return (
    <SwipeableRow
      leading={access === "none" ? null : {
        label: done ? t("À faire") : t("Fait"),
        icon: done ? "undo-variant" : "check",
        color: done ? colors.textMuted : colors.success,
        onPress: toggleDone,
      }}
      trailing={access !== "full" ? null : {
        label: t("Supprimer"),
        icon: "trash-can-outline",
        color: colors.danger,
        onPress: () => sessionHandlers.onDelete(session),
      }}
    >
    <SessionCard
      session={session}
      expanded={expanded}
      onPress={() => {
        animateNextLayout();
        onToggleExpand();
      }}
      onToggleDone={toggleDone}
      onEdit={() => sessionHandlers.onEdit(session)}
      onDuplicate={() => sessionHandlers.onDuplicate(session)}
      onDelete={() => sessionHandlers.onDelete(session)}
      readOnly={access !== "full"}
      canToggleDone={access !== "none"}
      riderLine={riderLine(session, team, rights.me)}
    />
    </SwipeableRow>
  );
}

/** « Léa monte », « Tu montes », « Monté par Léa »… ; null sans cavalier. */
function riderLine(session: TrainingSession, team: TeamMember[], me: string | null): string | null {
  // Cochée par soi sans cavalier attribué : le cas de qui monte seul, rien à dire.
  if (session.completed && session.doneByUserId && (session.doneByUserId !== me || session.riderUserId)) {
    const by = riderDisplayName({ riderUserId: session.doneByUserId }, team, me, t("toi"));
    if (by) return t("Monté par {name}", { name: by });
  }
  const name = riderDisplayName(session, team, me, t("toi"));
  if (!name) return null;
  if (session.riderUserId && session.riderUserId === me) return session.completed ? t("Monté par toi") : t("Tu montes");
  return session.completed ? t("Monté par {name}", { name }) : t("{name} monte", { name });
}
