/**
 * Ordre de l'écran Santé : ce qui arrive d'abord (le plus proche en tête),
 * puis l'historique (le plus récent en tête), affiché par pages. Avant, une
 * seule liste triée du plus lointain au plus ancien mettait un vaccin dans
 * six mois au-dessus du soin d'hier, et affichait tout l'historique d'un coup.
 */
export function splitHealthHistory<T extends { date: Date }>(appointments: T[], today: Date): { upcoming: T[]; past: T[] } {
  const upcoming = appointments.filter((a) => a.date > today).sort((a, b) => a.date.getTime() - b.date.getTime());
  const past = appointments.filter((a) => a.date <= today).sort((a, b) => b.date.getTime() - a.date.getTime());
  return { upcoming, past };
}
