/**
 * Classification des messages d'erreur Supabase Auth — module volontairement
 * sans dépendance (cf. le même pattern que planning/planningDestination.ts) :
 * un import depuis (onboarding)/account.tsx entraînerait le chargement de
 * tout l'écran (expo-router, expo-apple-authentication, plusieurs stores),
 * ce que Vitest ne peut pas faire tourner en environnement de test.
 *
 * Ces messages sont du texte libre côté serveur (pas de code d'erreur stable
 * garanti dans toutes les versions de GoTrue) — détection tolérante par
 * mot-clé plutôt qu'une correspondance exacte fragile qui casserait au
 * moindre changement de formulation.
 */

/** Vrai si l'erreur signifie que l'email n'est pas encore confirmé (cf.
 * (onboarding)/account.tsx checkEmailConfirmed, qui retente une connexion
 * pour savoir si la confirmation a eu lieu). */
export function isEmailNotConfirmedError(message: string): boolean {
  return /confirm/i.test(message);
}

/** Vrai si l'erreur signifie qu'un compte existe déjà avec cet email. */
export function isEmailAlreadyRegisteredError(message: string): boolean {
  return /already registered|already exists/i.test(message);
}

/** Traduit les messages d'erreur bruts de Supabase Auth (toujours en anglais,
 * quelle que soit la langue de l'app) vers un texte français compréhensible —
 * avant, `Alert.alert("Erreur", error.message)` affichait des messages comme
 * "Invalid login credentials" tels quels, dans une app 100% française (cf.
 * audit pré-publication). Ne couvre que les cas usuels rencontrés dans
 * login.tsx/reset-password.tsx/change-password-modal.tsx ; retombe sur le
 * message d'origine si aucun cas connu ne correspond, plutôt que d'inventer
 * une traduction incorrecte pour un message imprévu.
 */
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();

  if (m.includes("invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirme ton adresse email avant de te connecter (vérifie tes emails, y compris les spams).";
  }
  if (m.includes("user already registered") || m.includes("already registered") || m.includes("already exists")) {
    return "Un compte existe déjà avec cet email — connecte-toi plutôt.";
  }
  if (m.includes("password should be at least")) {
    return "Le mot de passe doit contenir au moins 6 caractères.";
  }
  if (m.includes("new password should be different")) {
    return "Le nouveau mot de passe doit être différent de l'ancien.";
  }
  if (m.includes("email rate limit") || m.includes("for security purposes") || m.includes("can only request this")) {
    return "Trop de tentatives — réessaie dans quelques instants.";
  }
  if (m.includes("network request failed") || m.includes("network error") || m.includes("fetch failed")) {
    return "Connexion impossible. Vérifie ta connexion internet et réessaie.";
  }
  if (m.includes("token has expired") || m.includes("invalid or expired") || m.includes("token is invalid")) {
    return "Ce lien n'est plus valide — demande-en un nouveau.";
  }

  return message;
}
