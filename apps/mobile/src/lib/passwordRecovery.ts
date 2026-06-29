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
