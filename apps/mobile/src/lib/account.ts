import { supabase } from "@/lib/supabase";

export class AccountError extends Error {}

/** Supprime définitivement le compte (données + auth) côté serveur. Ne nettoie
 * pas les caches locaux ni la session — c'est à l'appelant de faire
 * `resetOnboardingCompleted()` + `supabase.auth.signOut()` ensuite. */
export async function deleteAccount(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AccountError("Aucune session active.");

  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/account`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new AccountError(json?.error ?? "Erreur inconnue.");
  }
}
