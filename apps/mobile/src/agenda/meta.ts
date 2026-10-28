import { colors } from "@/theme/colors";
import { DISCIPLINES } from "@/onboarding/options";
import type { Discipline } from "@/onboarding/store";
import type { ReminderOption } from "@/lib/notifications";
import type { IconSpec } from "@/components/FormChips";
import {
  daysFromNow,
  type Appointment,
  type AppointmentType,
  type DocumentCategory,
  type ExpenseCategory,
  type Mood,
} from "@/agenda/store";
import { t, LOCALE } from "@/i18n";

export type { IconSpec };

export const DISCIPLINE_META: Record<Discipline, { label: string; icon: IconSpec }> = Object.fromEntries(
  DISCIPLINES.map((d) => [
    d.value,
    { label: d.label, icon: d.icon ?? { name: "horse-variant" as const, color: colors.primary } },
  ])
) as Record<Discipline, { label: string; icon: IconSpec }>;

export const APPT_META: Record<AppointmentType, { label: string; icon: IconSpec; chip: string; tag: string }> = {
  veto: { label: t("Vétérinaire"), icon: { name: "needle", color: colors.warning }, chip: "bg-warning/15", tag: "text-warning" },
  osteo: { label: t("Ostéopathe"), icon: { name: "bone", color: colors.accent }, chip: "bg-accent/15", tag: "text-accent" },
  marechal: { label: t("Maréchal-ferrant"), icon: { name: "hammer", color: colors.primary }, chip: "bg-primary/15", tag: "text-primary" },
  dentiste: { label: t("Dentiste équin"), icon: { name: "tooth-outline", color: colors.success }, chip: "bg-success/15", tag: "text-success" },
  vaccination: { label: t("Vaccination"), icon: { name: "needle", color: colors.success }, chip: "bg-success/15", tag: "text-success" },
  vermifuge: { label: t("Vermifuge"), icon: { name: "pill", color: colors.warning }, chip: "bg-warning/15", tag: "text-warning" },
  traitement: { label: t("Traitement"), icon: { name: "medical-bag", color: colors.primary }, chip: "bg-primary/15", tag: "text-primary" },
  concours: { label: t("Concours"), icon: { name: "trophy-outline", color: colors.accent }, chip: "bg-accent/15", tag: "text-accent" },
  autre: { label: t("Autre"), icon: { name: "calendar-blank-outline", color: colors.textMuted }, chip: "bg-border", tag: "text-muted" },
};

/** Types de rendez-vous "de soin" — pour lesquels les champs
 * praticien/coût/prochaine échéance ont du sens (cf. formulaire). Un concours
 * ou "autre" n'a pas de praticien à proprement parler. */
export const HEALTH_APPT_TYPES: readonly AppointmentType[] = [
  "veto",
  "osteo",
  "marechal",
  "dentiste",
  "vaccination",
  "vermifuge",
  "traitement",
];

export const DOC_META: Record<DocumentCategory, { label: string; icon: IconSpec; chip: string; tag: string }> = {
  facture: { label: t("Facture"), icon: { name: "receipt", color: colors.primary }, chip: "bg-primary/15", tag: "text-primary" },
  rapport: { label: t("Rapport"), icon: { name: "clipboard-text-outline", color: colors.accent }, chip: "bg-accent/15", tag: "text-accent" },
  ordonnance: { label: t("Ordonnance"), icon: { name: "pill", color: colors.warning }, chip: "bg-warning/15", tag: "text-warning" },
  autre: { label: t("Autre"), icon: { name: "paperclip", color: colors.textMuted }, chip: "bg-border", tag: "text-muted" },
};

export const EXPENSE_META: Record<ExpenseCategory, { label: string; icon: IconSpec; chip: string; tag: string }> = {
  veto: { label: t("Vétérinaire"), icon: { name: "needle", color: colors.warning }, chip: "bg-warning/15", tag: "text-warning" },
  marechal: { label: t("Maréchal-ferrant"), icon: { name: "hammer", color: colors.primary }, chip: "bg-primary/15", tag: "text-primary" },
  dentiste: { label: t("Dentiste équin"), icon: { name: "tooth-outline", color: colors.success }, chip: "bg-success/15", tag: "text-success" },
  osteo: { label: t("Ostéopathe"), icon: { name: "bone", color: colors.accent }, chip: "bg-accent/15", tag: "text-accent" },
  concours: { label: t("Concours"), icon: { name: "trophy-outline", color: colors.accent }, chip: "bg-accent/15", tag: "text-accent" },
  pension: { label: t("Pension"), icon: { name: "home-outline", color: colors.primary }, chip: "bg-primary/15", tag: "text-primary" },
  alimentation: { label: t("Alimentation"), icon: { name: "grass", color: colors.success }, chip: "bg-success/15", tag: "text-success" },
  complements: { label: t("Compléments"), icon: { name: "pill", color: colors.warning }, chip: "bg-warning/15", tag: "text-warning" },
  materiel: { label: t("Matériel"), icon: { name: "toolbox-outline", color: colors.accent }, chip: "bg-accent/15", tag: "text-accent" },
  transport: { label: t("Transport"), icon: { name: "truck-outline", color: colors.primary }, chip: "bg-primary/15", tag: "text-primary" },
  coaching: { label: t("Coaching"), icon: { name: "whistle-outline", color: colors.accent }, chip: "bg-accent/15", tag: "text-accent" },
  autre: { label: t("Autre"), icon: { name: "tag-outline", color: colors.textMuted }, chip: "bg-border", tag: "text-muted" },
};

export const REMINDER_META: Record<ReminderOption, { label: string; icon: IconSpec }> = {
  none: { label: t("Aucun"), icon: { name: "bell-off-outline", color: colors.textMuted } },
  "1h": { label: t("1 heure avant"), icon: { name: "bell-outline", color: colors.accent } },
  "1d": { label: t("1 jour avant"), icon: { name: "bell-outline", color: colors.accent } },
  "1w": { label: t("1 semaine avant"), icon: { name: "bell-outline", color: colors.accent } },
};

export const MOOD_META: Record<Mood, { emoji: string; label: string }> = {
  great: { emoji: "🤩", label: t("Top") },
  good: { emoji: "🙂", label: t("Bien") },
  okay: { emoji: "😐", label: t("Moyen") },
  hard: { emoji: "😣", label: t("Difficile") },
};

/** Catégories de dépense qui correspondent à un type de rendez-vous du même
 * nom (cf. suggestion de rapprochement dans le formulaire d'ajout) — les
 * valeurs locales des deux unions coïncident déjà
 * (veto/marechal/concours/dentiste/osteo). */
export function expenseCategoryToAppointmentType(category: ExpenseCategory): AppointmentType | null {
  return category === "veto" ||
    category === "marechal" ||
    category === "concours" ||
    category === "dentiste" ||
    category === "osteo"
    ? category
    : null;
}

/** Suggestion de rapprochement pour le formulaire de dépense (cf. ExpenseForm
 * `suggestedAppointmentFor`) — le rendez-vous le plus récent du type
 * correspondant à la catégorie de dépense, ou aucun si la catégorie n'a pas
 * d'équivalent (cf. expenseCategoryToAppointmentType). Identique dans
 * today.tsx/planning.tsx/horse/[id]/index.tsx (cf. plan Phase 3), extrait ici
 * pour ne plus le dupliquer — chaque appelant garde son propre
 * `horseAppointments` déjà filtré au bon cheval, passé en premier argument. */
export function suggestedAppointmentFor(
  appointments: Appointment[],
  category: ExpenseCategory
): Appointment | null {
  const apptType = expenseCategoryToAppointmentType(category);
  if (!apptType) return null;
  return appointments.filter((a) => a.type === apptType).sort((a, b) => b.date.getTime() - a.date.getTime())[0] ?? null;
}

export function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency }).format(amount);
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "dans 14 jours" / "aujourd'hui" / "il y a 3 jours" — pour l'échéance de
 * soin (cf. AppointmentCard) et l'historique du cheval. */
export function daysUntilLabel(date: Date): string {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - daysFromNow(0).getTime()) / (24 * 60 * 60 * 1000));
  if (days === 0) return "aujourd'hui";
  if (days > 0) return t("dans {days} jour{v}", { days: days, v: days > 1 ? "s" : "" });
  return t("il y a {v} jour{v2}", { v: -days, v2: -days > 1 ? "s" : "" });
}

/** id local le temps du formulaire de création (avant que l'épreuve ait un
 * vrai id, généré par addCompetitionEntry/addAppointment côté store). */
export function newDraftEntryId(): string {
  return `draft${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
