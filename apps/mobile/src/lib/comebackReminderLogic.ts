import { t } from "@/i18n";

/**
 * Relance d'inactivité — logique pure, testable (la programmation vit dans
 * lib/notifications.ts, scheduleComebackReminders).
 *
 * Les rappels sont reprogrammés à chaque retour dans l'app : ils ne partent
 * donc que si le cavalier n'est pas revenu depuis 4 puis 11 jours. Deux
 * relances au plus, puis le silence — au-delà, insister ferait désactiver les
 * notifications (et avec elles les rappels de soins, qui comptent davantage).
 */
export const COMEBACK_DELAYS_DAYS = [4, 11] as const;
const HOUR = 18;
const MINUTE = 30;

/** Dates des relances, à 18 h 30 heure locale (fin de journée, l'heure où
 * l'on repasse à l'écurie ou où l'on fait le point). */
export function comebackTriggers(now: Date): Date[] {
  return COMEBACK_DELAYS_DAYS.map((days) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(HOUR, MINUTE, 0, 0);
    return d;
  });
}

export function comebackMessage(index: number, horseName: string): { title: string; body: string } {
  return index === 0
    ? {
        title: t("Comment va {horseName} ?", { horseName }),
        body: t("Note sa dernière séance ou un soin en quelques secondes."),
      }
    : {
        title: t("{horseName} t'attend dans Horsetrack", { horseName }),
        body: t("Prépare la semaine : séances, maréchal, véto, tout au même endroit."),
      };
}
