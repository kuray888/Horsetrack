/** Fenêtre d'une échéance de soin « à surveiller » : la même pour l'alerte
 * de l'Accueil (cf. alerts.ts) et la tuile Santé de la fiche. */
export const HEALTH_WINDOW_DAYS = 14;

/**
 * Ton de la tuile Santé de la fiche : « à surveiller » seulement quand une
 * échéance tombe dans cette fenêtre. L'icône était toujours orange, même
 * sans rien à faire — un faux signal permanent.
 */
export function healthTileTone(nextDueDate: Date | null, today: Date): "due_soon" | "calm" {
  if (!nextDueDate) return "calm";
  const d = Math.round((nextDueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  return d >= 0 && d <= HEALTH_WINDOW_DAYS ? "due_soon" : "calm";
}
