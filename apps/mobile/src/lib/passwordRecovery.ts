/** Extrait les tokens de récupération de mot de passe du lien envoyé par
 * Supabase (cf. `resetPasswordForEmail` dans (auth)/forgot-password.tsx), qui
 * revient en deep link de la forme
 * `horsetrack://reset-password#access_token=...&refresh_token=...&type=recovery`.
 * Les tokens arrivent après un `#` (flow implicite, pas PKCE) — on retombe sur
 * un `?` par sécurité si jamais ils arrivaient en query string. */
export function extractRecoveryTokens(url: string): { accessToken: string; refreshToken: string } | null {
  if (!url.includes("type=recovery")) return null;

  const params = new URLSearchParams(url.split("#")[1] ?? url.split("?")[1] ?? "");
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;

  return { accessToken, refreshToken };
}

/** Identité portée par un jeton d'accès Supabase (JWT), lue sans vérification
 * de signature — uniquement pour comparer au compte déjà connecté avant de
 * remplacer la session, jamais pour accorder quoi que ce soit (Supabase
 * vérifie le jeton lui-même dans setSession). */
export function tokenIdentity(accessToken: string): { userId: string | null; email: string | null } {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return { userId: null, email: null };
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=")));
    return {
      userId: typeof json.sub === "string" ? json.sub : null,
      email: typeof json.email === "string" ? json.email : null,
    };
  } catch {
    return { userId: null, email: null };
  }
}
