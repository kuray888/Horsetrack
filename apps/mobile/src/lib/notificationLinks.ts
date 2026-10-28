import { HEALTH_APPOINTMENT_TYPES } from "@/lib/progress";

/**
 * Destination d'une notification touchée — logique pure, testable sans
 * runtime natif. Le chemin voyage dans `content.data.url` de la notification
 * (cf. scheduleReminder) et est suivi par components/NotificationRouter.
 *
 * Avant, toucher « Rappel : vaccin » ouvrait l'app là où on l'avait laissée :
 * il fallait ensuite retrouver soi-même le soin concerné.
 */

/** Rappel d'un rendez-vous : la page Santé du cheval pour un soin, le
 * Planning (filtré sur les concours le cas échéant) pour le reste. */
export function appointmentReminderUrl(type: string, horseId: string | null): string {
  if (horseId && HEALTH_APPOINTMENT_TYPES.has(type)) return `/horse/${horseId}/sante`;
  return type === "concours" ? "/(tabs)/planning?filter=concours" : "/(tabs)/planning";
}

/** Rappel de prochaine échéance de soin (vaccin, vermifuge…). */
export function nextDueReminderUrl(horseId: string | null): string {
  return horseId ? `/horse/${horseId}/sante` : "/(tabs)/planning";
}

/** Bilan du dimanche. */
export const WEEKLY_SUMMARY_URL = "/(tabs)/today";

/**
 * Seuls des chemins internes à l'app sont suivis : une notification ne doit
 * jamais pouvoir ouvrir une adresse externe ou un autre schéma. Un chemin
 * commence par un seul « / » et ne contient que des caractères de route.
 */
export function isInternalRoute(url: unknown): url is string {
  return typeof url === "string" && /^\/(?!\/)[A-Za-z0-9/()_\-?=&.]*$/.test(url) && !url.includes("..");
}
