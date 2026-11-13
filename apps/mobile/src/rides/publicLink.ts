import { supabase } from "@/lib/supabase";
import { readJson, writeJson } from "@/lib/localStore";
import type { PublicRidePayload } from "@/rides/publicLinkLogic";

/** Appels réseau du lien public (cf. publicLinkLogic.ts, apps/api/src/lib/publicRide.ts). */
export type PublicLink = { token: string; url: string };
const KEY = "public_ride_links_v1";

export async function getStoredLink(sessionId: string): Promise<PublicLink | null> {
  const map = await readJson<Record<string, PublicLink>>(KEY, {});
  return map[sessionId] ?? null;
}

async function storeLink(sessionId: string, link: PublicLink | null): Promise<void> {
  const map = await readJson<Record<string, PublicLink>>(KEY, {});
  if (link) map[sessionId] = link;
  else delete map[sessionId];
  await writeJson(KEY, map);
}

async function authedFetch(path: string, init: RequestInit): Promise<Response | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    return await fetch(`${process.env.EXPO_PUBLIC_API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
  } catch {
    return null;
  }
}

/** Crée (ou remplace) le lien de la séance ; null hors connexion ou en cas de refus. */
export async function createPublicLink(payload: PublicRidePayload): Promise<PublicLink | null> {
  const res = await authedFetch("/api/public-ride", { method: "POST", body: JSON.stringify(payload) });
  if (!res?.ok) return null;
  const json = (await res.json().catch(() => null)) as PublicLink | null;
  if (!json?.token || !json.url) return null;
  await storeLink(payload.sessionId, json);
  return json;
}

/** Supprime le lien : la page n'existe plus. Faux si le serveur n'a pas pu le faire. */
export async function revokePublicLink(sessionId: string, token: string): Promise<boolean> {
  const res = await authedFetch(`/api/public-ride?token=${encodeURIComponent(token)}`, { method: "DELETE" });
  if (!res?.ok) return false;
  await storeLink(sessionId, null);
  return true;
}
