import { LOCALE, t } from "@/i18n";

/**
 * Bilan du mois annoncé le 1er à 10 h (1.3.0) — logique pure, testable (la
 * programmation vit dans lib/notifications.ts, scheduleMonthlyReportReminder).
 *
 * Une notification par mois au plus, seulement si les notifications sont
 * déjà autorisées (jamais de demande ici), pour un cheval dont on est
 * propriétaire. Elle ouvre le rapport du mois : complet en Premium, aperçu
 * des séances en gratuit (cf. app/horse/[id]/rapport.tsx).
 */
export function nextMonthlyReportTrigger(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1, 10, 0, 0, 0);
}

/** Message du 1er : il parle du mois qui vient de finir. */
export function monthlyReportMessage(trigger: Date, horseName: string): { title: string; body: string } {
  const finished = new Date(trigger.getFullYear(), trigger.getMonth() - 1, 1);
  const month = finished.toLocaleDateString(LOCALE, { month: "long" });
  return {
    title: t("Le bilan de {month} de {horseName} est prêt", { month, horseName }),
    body: t("Séances, soins et pesées du mois, en un coup d'œil."),
  };
}

export function monthlyReportUrl(horseId: string): string {
  return `/horse/${horseId}/rapport`;
}
