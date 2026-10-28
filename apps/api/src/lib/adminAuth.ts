/**
 * Accès à la console d'administration (/admin) — authentification HTTP Basic
 * contre ADMIN_USER / ADMIN_PASSWORD. Fermée par défaut : sans ces deux
 * variables (mot de passe d'au moins 16 caractères), personne n'y accède.
 * Utilisé par le middleware ET revérifié dans chaque action serveur.
 */
export function isAdminConfigured(): boolean {
  const password = process.env.ADMIN_PASSWORD;
  return !!process.env.ADMIN_USER && !!password && password.length >= 16;
}

/** Comparaison en temps constant (crypto.timingSafeEqual n'existe pas en edge). */
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function isAdminAuthorized(header: string | null): boolean {
  if (!isAdminConfigured() || !header?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = atob(header.slice("Basic ".length));
  } catch {
    return false;
  }
  return safeEqual(decoded, `${process.env.ADMIN_USER}:${process.env.ADMIN_PASSWORD}`);
}
