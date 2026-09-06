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
