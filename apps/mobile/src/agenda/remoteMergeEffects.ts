import { cancelReminder, computeReminderTrigger, scheduleReminder } from "@/lib/notifications";
import { cancelEmailReminder, scheduleEmailReminder } from "@/lib/emailReminders";
import { appointmentReminderContent, nextDueReminderContent } from "@/agenda/reminderContent";
import type { Appointment } from "@/agenda/store";

/**
 * Rappels programmés SUR CET APPAREIL pour un rendez-vous modifié ou supprimé
 * ailleurs (autre appareil, demi-pension, coach) : sans ce suivi, la
 * notification sonnait à l'ancienne heure — ou pour un rendez-vous qui
 * n'existe plus.
 *
 * On ne programme rien de nouveau : on ne fait que suivre les rappels que cet
 * appareil avait déjà posés (identifiants présents en local). Un rendez-vous
 * sans rappel local reste sans rappel.
 */

export type ReminderIds = Pick<Appointment, "reminderNotificationId" | "emailReminderId" | "nextDueNotificationId">;

/** Le rappel doit-il être reprogrammé ? Pure (testée). */
export function reminderScheduleChanged(before: Appointment, after: Appointment): boolean {
  return (
    before.title !== after.title ||
    before.date.getTime() !== after.date.getTime() ||
    before.time !== after.time ||
    before.location !== after.location ||
    before.reminder !== after.reminder ||
    before.type !== after.type ||
    before.horseId !== after.horseId ||
    (before.nextDueDate?.getTime() ?? null) !== (after.nextDueDate?.getTime() ?? null)
  );
}

function hasLocalReminders(a: ReminderIds): boolean {
  return !!(a.reminderNotificationId || a.emailReminderId || a.nextDueNotificationId);
}

/** Annule les rappels locaux d'un rendez-vous supprimé ailleurs. */
export function cancelRemindersOf(appointment: ReminderIds): void {
  cancelReminder(appointment.reminderNotificationId);
  cancelEmailReminder(appointment.emailReminderId);
  cancelReminder(appointment.nextDueNotificationId);
}

/**
 * Reprogramme les rappels locaux d'un rendez-vous modifié ailleurs. Renvoie
 * les nouveaux identifiants à reporter dans l'état local, ou null s'il n'y
 * avait rien à faire.
 */
export async function rescheduleReminders(
  before: Appointment,
  after: Appointment,
  horseName: string | null
): Promise<ReminderIds | null> {
  if (!hasLocalReminders(before) || !reminderScheduleChanged(before, after)) return null;
  cancelRemindersOf(before);

  let reminderNotificationId: string | null = null;
  let emailReminderId: string | null = null;
  const trigger = computeReminderTrigger(after.date, after.time, after.reminder);
  if (trigger) {
    const content = appointmentReminderContent(after.title, after.date, after.time, after.location, horseName);
    [reminderNotificationId, emailReminderId] = await Promise.all([
      before.reminderNotificationId ? scheduleReminder(content.title, content.body, trigger).catch(() => null) : null,
      before.emailReminderId ? scheduleEmailReminder(trigger, content.title, content.body) : null,
    ]);
  }

  let nextDueNotificationId: string | null = null;
  if (before.nextDueNotificationId && after.nextDueDate) {
    const content = nextDueReminderContent(after.type, after.title, after.nextDueDate, horseName);
    if (content.trigger) {
      nextDueNotificationId = await scheduleReminder(content.title, content.body, content.trigger).catch(() => null);
    }
  }
  return { reminderNotificationId, emailReminderId, nextDueNotificationId };
}
