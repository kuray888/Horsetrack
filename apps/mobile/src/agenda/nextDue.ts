import type { AppointmentType } from "@/agenda/store";
import { t } from "@/i18n";

export type NextDueShortcut = { label: string; weeks?: number; months?: number };

const W = (weeks: number): NextDueShortcut => ({ label: t("{weeks} sem.", { weeks: weeks }), weeks });
const M = (months: number): NextDueShortcut => ({ label: months === 12 ? t("1 an") : t("{months} mois", { months: months }), months });

/**
 * Raccourcis pour la date de prochaine échéance, selon le soin : des écarts
 * d'usage courant (ferrure toutes les 6 à 10 semaines, vaccin annuel ou
 * semestriel…), à partir de la date du rendez-vous. Ce sont des raccourcis
 * de saisie, pas des recommandations : rien n'est présélectionné, et le
 * sélecteur de date reste là pour tout autre rythme.
 */
export function nextDueShortcuts(type: AppointmentType): NextDueShortcut[] {
  switch (type) {
    case "marechal":
      return [W(6), W(8), W(10)];
    case "vermifuge":
      return [M(3), M(4), M(6)];
    case "vaccination":
      return [M(6), M(12)];
    case "dentiste":
      return [M(6), M(12)];
    case "osteo":
      return [M(3), M(6), M(12)];
    case "veto":
    case "traitement":
      return [W(2), M(1), M(3)];
    default:
      return [];
  }
}

/** Date obtenue en appliquant le raccourci à la date du rendez-vous. Les
 * mois sont calendaires, et une fin de mois trop courte retombe sur son
 * dernier jour (31 janvier + 1 mois = 28 ou 29 février, pas 3 mars). */
export function applyNextDueShortcut(from: Date, shortcut: NextDueShortcut): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (shortcut.weeks) d.setDate(d.getDate() + shortcut.weeks * 7);
  if (shortcut.months) {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + shortcut.months);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
  }
  return d;
}
