import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { supabase } from "@/lib/supabase";
import { LANG } from "@/i18n";

/**
 * Jeton de notification push (Expo) de l'appareil, envoyé à l'API pour que
 * les participants d'un fil privé soient prévenus d'un commentaire (cf.
 * apps/api /api/community/notify).
 *
 * Ne demande JAMAIS la permission : seulement si elle a déjà été donnée
 * (rappels, bilan du dimanche). Silencieux en cas d'échec (simulateur,
 * client de développement sans projet EAS) : le fil marche sans push.
 */

let lastSent: string | null = null;

async function deviceToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const { granted } = await Notifications.getPermissionsAsync().catch(() => ({ granted: false }));
  if (!granted) return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return null;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId }).catch(() => ({ data: null as string | null }));
  return data;
}

async function call(method: "POST" | "DELETE", token: string): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const access = data.session?.access_token;
  if (!access) return false;
  const base = `${process.env.EXPO_PUBLIC_API_URL}/api/push/register`;
  const res = await fetch(method === "DELETE" ? `${base}?token=${encodeURIComponent(token)}` : base, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
    body: method === "POST" ? JSON.stringify({ token, platform: Platform.OS, lang: LANG }) : undefined,
  }).catch(() => null);
  return !!res?.ok;
}

/** Au lancement, au retour au premier plan, et après une connexion. */
export async function registerPushToken(): Promise<void> {
  const token = await deviceToken();
  if (!token) return;
  const { data } = await supabase.auth.getSession();
  const key = `${data.session?.user.id ?? ""}:${token}`;
  if (key === lastSent) return;
  if (await call("POST", token)) lastSent = key;
}

/** Avant une déconnexion : l'appareil ne reçoit plus rien pour ce compte. */
export async function unregisterPushToken(): Promise<void> {
  const token = await deviceToken();
  if (token) await call("DELETE", token);
  lastSent = null;
}
