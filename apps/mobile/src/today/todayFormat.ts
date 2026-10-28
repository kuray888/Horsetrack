import { MONTHS, isSameDate } from "@/lib/dateFormat";
import { t } from "@/i18n";

/**
 * Textes de l'Accueil — logique pure, testée (todayFormat.test.ts). Sortis
 * de app/(tabs)/today.tsx avec le découpage de l'écran.
 */

const DAY_SHORT_BY_GETDAY = [t("Dim."), t("Lun."), t("Mar."), t("Mer."), t("Jeu."), t("Ven."), t("Sam.")];

/** « Aujourd'hui · 18:00 », « Demain », « Mer. 4 nov. · 9:30 ». */
export function formatWhen(date: Date, time?: string, now: Date = new Date()): string {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const suffix = time ? ` · ${time}` : "";
  if (isSameDate(date, todayStart)) return `${t("Aujourd'hui")}${suffix}`;
  if (isSameDate(date, tomorrowStart)) return t("Demain{suffix}", { suffix: suffix });
  return `${DAY_SHORT_BY_GETDAY[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}${suffix}`;
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return t("Bonjour");
  if (h < 18) return t("Bon après-midi");
  return t("Bonsoir");
}

export function weeklyRecapMessage(done: number, total: number): string {
  if (total === 0) return t("Aucune séance planifiée cette semaine.");
  if (done === 0) return t("La semaine commence — à toi de planifier la première séance !");
  if (done === total) return t("Semaine parfaite ! Les {total} séances planifiées sont faites. 🎉", { total: total });
  return t("{done}/{total} séances faites cette semaine. Encore {left} pour finir en beauté.", {
    done,
    total,
    left: total - done,
  });
}
