import { createPrivateKey, sign } from "node:crypto";

/**
 * Révocation « Se connecter avec Apple » à la suppression du compte — exigée
 * par Apple depuis le 30/06/2022 pour toute app proposant ce mode de connexion
 * (guideline 5.1.1(v), « Sign in with Apple REST API » : /auth/revoke). Sans
 * elle, l'app reste listée dans les réglages Apple de l'utilisateur comme
 * encore autorisée, et c'est un motif de rejet en review.
 *
 * Supabase ne conserve pas le jeton Apple : l'app redemande donc un
 * `authorizationCode` frais juste avant la suppression (cf. mobile
 * lib/appleAuth.ts), échangé ici contre un refresh token puis révoqué.
 *
 * Configuration (Vercel) — clé « Sign in with Apple » créée dans Certificates,
 * Identifiers & Profiles → Keys :
 *   APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY (contenu du .p8, les retours
 *   à la ligne pouvant être écrits `\n`), APPLE_CLIENT_ID (bundle id de l'app).
 * Sans elles, tout est inerte : la suppression du compte n'en dépend jamais.
 */

type AppleConfig = { teamId: string; keyId: string; privateKey: string; clientId: string };

function appleConfig(): AppleConfig | null {
  const { APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY, APPLE_CLIENT_ID } = process.env;
  if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY || !APPLE_CLIENT_ID) return null;
  return {
    teamId: APPLE_TEAM_ID,
    keyId: APPLE_KEY_ID,
    privateKey: APPLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    clientId: APPLE_CLIENT_ID,
  };
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** `client_secret` exigé par l'API Apple : JWT ES256 signé avec la clé .p8,
 * valable 5 minutes. Exporté pour les tests. */
export function appleClientSecret(config: AppleConfig, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = base64url(JSON.stringify({ alg: "ES256", kid: config.keyId }));
  const payload = base64url(
    JSON.stringify({
      iss: config.teamId,
      iat: nowSeconds,
      exp: nowSeconds + 300,
      aud: "https://appleid.apple.com",
      sub: config.clientId,
    })
  );
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), {
    key: createPrivateKey(config.privateKey),
    // Signature JOSE (r||s, 64 octets), pas le DER par défaut de Node.
    dsaEncoding: "ieee-p1363",
  });
  return `${header}.${payload}.${base64url(signature)}`;
}

/** Révoque l'autorisation Apple liée à ce code. Best-effort : vrai si Apple
 * a confirmé, faux sinon (config absente, code expiré — 5 min —, réseau). */
export async function revokeAppleAuthorization(authorizationCode: string): Promise<boolean> {
  const config = appleConfig();
  if (!config) return false;
  try {
    const clientSecret = appleClientSecret(config);
    const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: clientSecret,
        code: authorizationCode,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!tokenRes.ok) {
      console.warn("[apple:revoke] échange du code refusé", tokenRes.status);
      return false;
    }
    const { refresh_token: refreshToken } = (await tokenRes.json()) as { refresh_token?: string };
    if (!refreshToken) return false;
    const revokeRes = await fetch("https://appleid.apple.com/auth/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: clientSecret,
        token: refreshToken,
        token_type_hint: "refresh_token",
      }),
      signal: AbortSignal.timeout(5000),
    });
    return revokeRes.ok;
  } catch (e) {
    console.warn("[apple:revoke] révocation échouée", e);
    return false;
  }
}
