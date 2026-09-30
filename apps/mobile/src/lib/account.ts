import { supabase } from "@/lib/supabase";

export class AccountError extends Error {
  /** Le serveur a déjà effacé données et fichiers, seule la fermeture du
   * compte a échoué (cf. api/account) : le cache local ne correspond plus à
   * rien et doit être vidé quand même. */
  constructor(message: string, readonly dataDeleted = false) {
    super(message);
  }
}

/** Supprime définitivement le compte (données + auth) côté serveur. Ne nettoie
 * pas les caches locaux ni la session — c'est à l'appelant de faire
 * `resetOnboardingCompleted()` + `supabase.auth.signOut()` ensuite. */
export async function deleteAccount(options: { appleAuthorizationCode?: string | null } = {}): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AccountError("Aucune session active.");

  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/account`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ appleAuthorizationCode: options.appleAuthorizationCode ?? null }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new AccountError(json?.error ?? "Erreur inconnue.", json?.dataDeleted === true);
  }
}
