/**
 * Où ranger les proches de la sécurité en balade : un fichier PAR COMPTE.
 * Avant, un seul fichier pour le téléphone : un second compte connecté dessus
 * voyait les proches du premier (et pouvait leur envoyer une alerte).
 *
 * Les réglages d'avant (fichier unique) sont repris par le compte à qui
 * appartiennent les données de l'appareil, puis ne servent plus.
 */
export const SAFETY_LEGACY_KEY = "ride_safety_v1";

export function safetyKeyForUser(userId: string): string {
  return `${SAFETY_LEGACY_KEY}_${userId}`;
}

/** L'ancien fichier unique est-il à reprendre pour ce compte ? Seulement si
 * c'est lui le propriétaire des données de l'appareil. */
export function shouldAdoptLegacySafety(userId: string | null, deviceOwner: string | null): boolean {
  return !!userId && deviceOwner === userId;
}
