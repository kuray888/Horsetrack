import { t } from "@/i18n";

/**
 * Messages que l'API renvoie en français et que l'app affiche tels quels
 * (codes promo, suppression du compte). Dans une app en anglais ils
 * restaient en français (cf. audit du 2026-11-11) : l'app les traduit à
 * l'affichage avec `serverMessage()`. Toute nouvelle phrase d'API montrée à
 * l'utilisateur s'ajoute ici et dans i18n/en.ts (serverMessages.test.ts).
 */
export const SERVER_MESSAGES = [
  "Ce code promo a atteint sa limite d'utilisation.",
  "Ce code promo a expiré.",
  "Ce code promo est réservé aux anciens abonnés.",
  "Ce code promo est réservé aux comptes créés récemment.",
  "Ce code promo est réservé aux personnes qui n'ont jamais été abonnées.",
  "Ce code promo n'existe pas ou n'est plus valide.",
  "Code invalide.",
  "Profil introuvable.",
  "Tu as déjà utilisé ce code promo.",
  "Tu profites déjà de Horsetrack Premium — code enregistré, merci !",
  "Tes données ont été supprimées, mais la fermeture du compte a échoué — écris-nous pour la finaliser.",
  "Suppression bloquée par des données liées à ton compte — contacte le support.",
  "Erreur serveur lors de la suppression de tes données.",
  "Trop d'invitations envoyées aujourd'hui.",
] as const;

/** Traduit un message d'API connu ; un message inconnu est gardé tel quel. */
export function serverMessage(message: string): string {
  return t(message);
}
