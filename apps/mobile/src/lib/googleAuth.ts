import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";
import { runNativeInteraction } from "@/lib/nativeInteraction";

/**
 * Connexion avec Google, par le navigateur sécurisé du système (Supabase
 * OAuth) plutôt qu'un SDK Google : aucun identifiant à compiler dans l'app,
 * tout se règle dans Supabase (fournisseur Google + adresse de retour
 * autorisée « horsetrack://auth-callback »).
 *
 * Masquée tant que EXPO_PUBLIC_GOOGLE_AUTH ne vaut pas « 1 » : sans le
 * fournisseur activé côté Supabase, le bouton ne mènerait qu'à une erreur.
 */
export const GOOGLE_AUTH_ENABLED = process.env.EXPO_PUBLIC_GOOGLE_AUTH === "1";

export type GoogleSignInResult = { cancelled: true } | { cancelled: false; userId: string };

/** Code PKCE ou jetons (flux implicite) renvoyés dans l'adresse de retour. */
export function parseAuthCallback(url: string): { code: string } | { accessToken: string; refreshToken: string } | { error: string } | null {
  const [, query = ""] = url.split("?");
  const [queryPart, hash = ""] = query.split("#");
  const fragment = url.includes("#") ? url.slice(url.indexOf("#") + 1) : hash;
  const params = new URLSearchParams(queryPart);
  const frag = new URLSearchParams(fragment);
  const error = params.get("error_description") ?? params.get("error") ?? frag.get("error_description") ?? frag.get("error");
  if (error) return { error };
  const code = params.get("code");
  if (code) return { code };
  const accessToken = frag.get("access_token");
  const refreshToken = frag.get("refresh_token");
  if (accessToken && refreshToken) return { accessToken, refreshToken };
  return null;
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const redirectTo = Linking.createURL("auth-callback");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) throw new Error(error?.message ?? "Google sign-in unavailable");

  const result = await runNativeInteraction(() => WebBrowser.openAuthSessionAsync(data.url, redirectTo));
  if (result.type !== "success") return { cancelled: true };

  const parsed = parseAuthCallback(result.url);
  if (!parsed) throw new Error("Google sign-in failed");
  if ("error" in parsed) throw new Error(parsed.error);
  const session =
    "code" in parsed
      ? await supabase.auth.exchangeCodeForSession(parsed.code)
      : await supabase.auth.setSession({ access_token: parsed.accessToken, refresh_token: parsed.refreshToken });
  if (session.error || !session.data.session) throw new Error(session.error?.message ?? "Google sign-in failed");
  return { cancelled: false, userId: session.data.session.user.id };
}
