/**
 * Interrupteurs de fonctionnalités livrées côté serveur mais pas encore
 * ouvertes dans l'app.
 *
 * `PRO_ENABLED` : Écurie Pro (achat, vue écurie, créneaux, tâches, frais,
 * rapport du mois). La 1.2.0 part avec Premium seul : la base, l'API et
 * l'espace /gestion restent en place, mais aucun écran de l'app ne propose ni
 * n'ouvre Pro. Aucun abonné existant n'y perd quoi que ce soit : tout ce qui
 * est caché est nouveau. Pour ouvrir Pro (docs/ecurie-pro.md), passer à true.
 */
export const PRO_ENABLED = false;
