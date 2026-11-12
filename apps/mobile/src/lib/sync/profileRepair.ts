/**
 * Profil cavalier côté serveur (`rider_profiles`) : sans lui, rien ne part.
 *
 * Seule l'app crée cette ligne (cf. sync/horses.ts pushRiderProfile ; le
 * trigger `handle_new_user` de rls.sql ne crée que `users`), en un unique
 * envoi à la fin de l'onboarding. Si cet envoi échouait (réseau coupé à
 * l'écurie, app fermée trop tôt), il n'était jamais retenté, et :
 * - l'envoi des chevaux s'arrêtait en silence (`skipped`, cf. pushHorsesImpl) ;
 * - celui des documents aussi (pushDocumentImpl renvoie null, sans file) ;
 * - la relecture régulière ne rattrapait rien : pullCloudData renvoie null
 *   sans profil (ou sans `onboardingCompletedAt`), donc la fusion des chevaux,
 *   qui renvoie ce que le serveur n'a jamais reçu, ne tournait jamais.
 * Tout restait sur le seul téléphone, et disparaissait au changement
 * d'appareil (cf. remontée client du 2026-11-12).
 *
 * Ici, la relecture vérifie d'abord le profil et le recrée depuis le profil
 * local s'il manque. Logique pure : les accès réseau sont fournis par
 * l'appelant (cf. lib/cloudRefresh.tsx).
 */

export type ServerProfile = { id: string; onboardingCompletedAt: string | null } | null;

export type ProfileRepairOutcome =
  /** Profil complet sur le serveur : rien à faire. */
  | "present"
  /** Profil absent ou incomplet, renvoyé avec succès. */
  | "repaired"
  /** Profil absent ou incomplet, renvoi en échec : retenté à la prochaine relecture. */
  | "failed"
  /** Lecture impossible (réseau) : on ne sait rien, on n'écrit rien. */
  | "unknown";

/** Le serveur a-t-il besoin qu'on lui renvoie le profil ? Un profil sans
 * `onboardingCompletedAt` compte comme absent : pullCloudData l'ignore. */
export function serverProfileNeedsRepair(profile: ServerProfile): boolean {
  return !profile || !profile.onboardingCompletedAt;
}

export async function ensureServerRiderProfile(deps: {
  /** Profil serveur du compte connecté ; lève en cas d'erreur réseau/serveur
   * (une erreur ne doit jamais passer pour « pas de profil »). */
  readProfile: () => Promise<ServerProfile>;
  /** Envoie le profil local ; vrai si le serveur l'a enregistré. */
  pushProfile: () => Promise<boolean>;
}): Promise<ProfileRepairOutcome> {
  let profile: ServerProfile;
  try {
    profile = await deps.readProfile();
  } catch {
    return "unknown";
  }
  if (!serverProfileNeedsRepair(profile)) return "present";
  const ok = await deps.pushProfile().catch(() => false);
  return ok ? "repaired" : "failed";
}
