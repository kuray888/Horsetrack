import type { MaterialCommunityIcons } from "@expo/vector-icons";
import { ACTIVITY_META, type Appointment, type Expense, type JournalEntry } from "@/agenda/store";
import { APPT_META, EXPENSE_META } from "@/agenda/meta";
import type { TrainingSession } from "@/sessions/store";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export type ActivityEntry = {
  id: string;
  date: Date;
  icon: IconName;
  iconColor: string;
  title: string;
  subtitle: string | null;
};

/**
 * "Vie du cheval" — fusion chronologique de tout ce qui s'est passé pour un
 * cheval (séances, soins/rendez-vous, journal, dépenses), en lecture seule.
 * Extrait de horse-history-modal.tsx (cf. plan Phase 3 Étape 2) pour être
 * partagé avec le Horse Hub — logique inchangée, seuls les labels/icônes
 * viennent maintenant de agenda/meta.ts (APPT_META/EXPENSE_META, exportés
 * depuis, qui ne l'étaient pas encore quand cet écran a été écrit) plutôt que
 * d'une copie locale.
 */
export function buildActivityEntries(
  horseId: string,
  data: {
    sessions: TrainingSession[];
    appointments: Appointment[];
    journal: JournalEntry[];
    expenses: Expense[];
  },
  upTo: Date = new Date()
): ActivityEntry[] {
  const { sessions, appointments, journal, expenses } = data;

  const entries: ActivityEntry[] = [
    ...sessions
      .filter((s) => s.horseId === horseId && s.completed && s.date <= upTo)
      .map((s) => ({
        id: `session-${s.id}`,
        date: s.date,
        icon: ACTIVITY_META[s.activityType].icon,
        iconColor: ACTIVITY_META[s.activityType].tint,
        title: `Séance ${ACTIVITY_META[s.activityType].label.toLowerCase()}`,
        subtitle: s.durationMinutes ? `${s.durationMinutes} min` : null,
      })),
    ...appointments
      .filter((a) => a.horseId === horseId && a.date <= upTo)
      .map((a) => ({
        id: `appt-${a.id}`,
        date: a.date,
        icon: APPT_META[a.type].icon.name,
        iconColor: APPT_META[a.type].icon.color,
        title: a.title || APPT_META[a.type].label,
        subtitle: a.type === "concours" && a.result ? a.result : APPT_META[a.type].label,
      })),
    ...journal
      .filter((j) => j.horseId === horseId && j.date <= upTo)
      .map((j) => ({
        id: `journal-${j.id}`,
        date: j.date,
        icon: ACTIVITY_META[j.activityType].icon,
        iconColor: ACTIVITY_META[j.activityType].tint,
        title: `Journal — ${ACTIVITY_META[j.activityType].label}`,
        subtitle: j.notes || null,
      })),
    ...expenses
      .filter((e) => e.horseId === horseId && e.date <= upTo)
      .map((e) => ({
        id: `expense-${e.id}`,
        date: e.date,
        icon: EXPENSE_META[e.category].icon.name,
        iconColor: EXPENSE_META[e.category].icon.color,
        title: EXPENSE_META[e.category].label,
        subtitle: new Intl.NumberFormat("fr-FR", { style: "currency", currency: e.currency }).format(e.amount),
      })),
  ];

  return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
}
