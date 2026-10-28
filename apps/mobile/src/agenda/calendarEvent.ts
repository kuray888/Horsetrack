import { t } from "@/i18n";

/**
 * Rendez-vous ou concours → événement du Calendrier du téléphone. Logique
 * pure : agenda/addToCalendar.ts se charge d'ouvrir la fiche système.
 *
 * Règles :
 * - avec une heure : 1 h par défaut, la durée réelle d'un rendez-vous véto
 *   ou maréchal n'étant jamais saisie ; le cavalier l'ajuste dans la fiche ;
 * - sans heure, ou concours sur plusieurs jours : journée entière, du premier
 *   au dernier jour ;
 * - journée entière : iOS attend une fin le dernier jour, Android (comme le
 *   format iCalendar) une fin exclusive au lendemain à minuit. Sinon, l'un des
 *   deux affiche un jour de trop ou de moins.
 */

export type CalendarSource = {
  title: string;
  typeLabel: string;
  horseName: string | null;
  date: Date;
  endDate: Date | null;
  time: string;
  location: string;
  notes: string;
  professional: string | null;
  dossard: string | null;
};

export type CalendarEventData = {
  title: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  location: string;
  notes: string;
};

const TIME_RE = /^([01]?\d|2[0-3])[:h]([0-5]\d)$/;

function dayAt(d: Date, hours = 0, minutes = 0): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours, minutes, 0, 0);
}

export function toCalendarEvent(src: CalendarSource, platform: "ios" | "android"): CalendarEventData {
  const lastDay = src.endDate && src.endDate > src.date ? src.endDate : src.date;
  const multiDay = lastDay !== src.date && dayAt(lastDay).getTime() !== dayAt(src.date).getTime();
  const match = TIME_RE.exec(src.time.trim());

  let startDate: Date;
  let endDate: Date;
  let allDay: boolean;
  if (match && !multiDay) {
    startDate = dayAt(src.date, Number(match[1]), Number(match[2]));
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    allDay = false;
  } else {
    allDay = true;
    startDate = dayAt(src.date);
    endDate =
      platform === "android"
        ? new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1)
        : dayAt(lastDay, 23, 59);
  }

  // Le nom du cheval dans le titre : dans un agenda familial ou partagé avec
  // la DP, « Maréchal » seul ne dit pas de quel cheval il s'agit.
  const title = src.horseName ? `${src.title} · ${src.horseName}` : src.title;
  const notes = [
    src.typeLabel,
    src.professional ? t("Avec : {professional}", { professional: src.professional }) : "",
    src.dossard ? t("Dossard : {dossard}", { dossard: src.dossard }) : "",
    src.notes.trim(),
    t("Ajouté depuis Horsetrack"),
  ]
    .filter(Boolean)
    .join("\n");

  return { title, startDate, endDate, allDay, location: src.location.trim(), notes };
}
