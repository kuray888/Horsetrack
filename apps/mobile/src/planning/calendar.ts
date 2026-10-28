import { isSameDate, MONTHS } from "@/lib/dateFormat";
import { t } from "@/i18n";

/** Calculs de calendrier du Planning — sortis de app/(tabs)/planning.tsx
 * tels quels (fonctions pures). */

const DAY_SHORT = [t("Dim."), t("Lun."), t("Mar."), t("Mer."), t("Jeu."), t("Ven."), t("Sam.")];

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Grille de 6 semaines (toujours 42 jours) commençant un lundi, incluant les
 * jours du mois précédent/suivant nécessaires pour compléter la première et
 * la dernière semaine — même convention "lundi = début de semaine" que
 * weekStart plus bas. */
export function buildMonthGrid(monthCursor: Date): Date[] {
  const first = startOfMonth(monthCursor);
  const firstWeekday = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(gridStart.getDate() - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function dayHeaderLabel(date: Date): string {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  if (isSameDate(date, todayStart)) return "Aujourd'hui";
  if (isSameDate(date, tomorrowStart)) return t("Demain");
  return `${DAY_SHORT[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** Regroupe une liste déjà triée par date en blocs par jour, pour un affichage
 * "Aujourd'hui / Demain / Lun. 8 sept." plus lisible qu'une liste plate. */
export function groupByDay<T extends { date: Date }>(items: T[]): { key: string; label: string; items: T[] }[] {
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const key = item.date.toDateString();
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: dayHeaderLabel(item.date), items: [item] });
  }
  return groups;
}
