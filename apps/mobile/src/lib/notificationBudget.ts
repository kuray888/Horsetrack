/**
 * Combien de rappels locaux peut-on encore programmer ?
 *
 * iOS ne conserve que 64 notifications locales en attente par application, et
 * ce plafond n'est pas une erreur : au-delà, le système garde les 64 dont la
 * date est la plus proche et jette silencieusement les autres. Rien ne le
 * signale — ni à l'app, ni à l'utilisateur, qui découvre l'absence de rappel
 * le jour du rendez-vous.
 *
 * `MAX_ENTRIES_PER_SUBMIT` (cf. horses/selectableHorses.ts) plafonne UNE
 * soumission, mais rien ne comptait le total déjà programmé : trois créations
 * récurrentes successives suffisent à dépasser la limite.
 *
 * Module pur, sans dépendance à expo-notifications, pour rester testable.
 */

/** Plafond iOS de notifications locales en attente, par application. */
export const IOS_PENDING_NOTIFICATION_LIMIT = 64;

/** Places encore disponibles avant que le système commence à jeter des
 * rappels. Jamais négatif : au-delà du plafond, il n'y a plus de place, pas
 * une dette. */
export function remainingReminderSlots(pending: number): number {
  return Math.max(0, IOS_PENDING_NOTIFICATION_LIMIT - pending);
}

/**
 * Message d'avertissement si la création demandée dépasse le budget, `null`
 * sinon.
 *
 * `about` est le nombre de rappels que la soumission va programmer — pour un
 * rendez-vous, une notification par entrée créée (chevaux × occurrences), et
 * une de plus par entrée portant une prochaine échéance de soin.
 *
 * N'interdit rien : le rendez-vous lui-même sera bien enregistré, et c'est ce
 * qui compte. On dit seulement ce que le système fera des rappels, pour que
 * l'utilisateur puisse réduire la répétition s'il y tient.
 */
export function reminderBudgetWarning(pending: number, about: number): string | null {
  const free = remainingReminderSlots(pending);
  if (about <= free) return null;
  const lost = about - free;
  return (
    `${pending} rappel${pending > 1 ? "s sont" : " est"} déjà programmé${pending > 1 ? "s" : ""} sur cet appareil, et iOS n'en garde que ` +
    `${IOS_PENDING_NOTIFICATION_LIMIT} à la fois. ${lost === 1 ? "Un rappel" : `${lost} rappels`} ` +
    `${lost === 1 ? "risque" : "risquent"} de ne pas se déclencher — les plus lointains d'abord. ` +
    `Le rendez-vous, lui, sera bien enregistré.`
  );
}
