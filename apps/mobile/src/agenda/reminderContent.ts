import { formatDate } from "@/lib/dateFormat";
import { APPT_META } from "@/agenda/meta";
import type { AppointmentType } from "@/agenda/store";
import { t } from "@/i18n";

/** Contenu du rappel d'un rendez-vous — partagé par le formulaire (cf.
 * hooks/useAppointmentForm.ts) et la reprogrammation après une modification
 * faite ailleurs (cf. agenda/store.tsx mergeFromCloud), pour que les deux
 * produisent exactement la même notification. */
export function appointmentReminderContent(
  title: string,
  date: Date,
  time: string,
  location: string,
  horseName: string | null
): { title: string; body: string } {
  return {
    title: t("Rappel : {title}", { title: title }),
    body: `${horseName ? `${horseName} · ` : ""}${formatDate(date)}${time ? t(" à {time}", { time: time }) : ""}${location ? ` · ${location}` : ""}`,
  };
}

/** Rappel de prochaine échéance de soin : 3 jours avant à 9h. `trigger` null
 * si ce moment est déjà passé. */
export function nextDueReminderContent(
  apptType: AppointmentType,
  title: string,
  nextDueDate: Date,
  horseName: string | null,
  now: Date = new Date()
): { title: string; body: string; trigger: Date | null } {
  const trigger = new Date(nextDueDate);
  trigger.setDate(trigger.getDate() - 3);
  trigger.setHours(9, 0, 0, 0);
  return {
    title: t("Échéance à venir : {title}", { title: title }),
    body: t("{label} prévu(e) le {formatDate} pour {v}.", { label: APPT_META[apptType].label, formatDate: formatDate(nextDueDate), v: horseName ?? "ton cheval" }),
    trigger: trigger.getTime() > now.getTime() ? trigger : null,
  };
}
