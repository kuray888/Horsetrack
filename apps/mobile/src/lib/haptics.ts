/**
 * Retours haptiques des moments clés (sélection, validation, erreur).
 *
 * Chargé paresseusement et sans jamais rejeter : un client de développement
 * compilé avant l'ajout d'expo-haptics n'a pas le module natif, et
 * l'importer directement planterait l'app au démarrage. Sans module : no-op.
 * Volontairement rare (jamais sur un simple défilement ou une navigation) :
 * un retour sur chaque toucher perd son sens.
 */
type HapticsModule = typeof import("expo-haptics");

let mod: HapticsModule | null | undefined;

function haptics(): HapticsModule | null {
  if (mod !== undefined) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("expo-haptics") as HapticsModule;
  } catch {
    mod = null;
  }
  return mod;
}

/** Changement de choix (formule, onglet de filtre, option). */
export function hapticSelection(): void {
  haptics()?.selectionAsync().catch(() => {});
}

/** Action physique légère (cocher, ouvrir une feuille d'ajout). */
export function hapticTap(): void {
  const h = haptics();
  h?.impactAsync(h.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Réussite (séance faite, code validé, achat confirmé). */
export function hapticSuccess(): void {
  const h = haptics();
  h?.notificationAsync(h.NotificationFeedbackType.Success).catch(() => {});
}

/** Échec signalé à l'utilisateur (code refusé, erreur d'enregistrement). */
export function hapticError(): void {
  const h = haptics();
  h?.notificationAsync(h.NotificationFeedbackType.Error).catch(() => {});
}
