import { db } from "@cheval/db";

export type ExpoPushMessage = { to: string; title: string; body: string; sound: "default"; data: Record<string, unknown> };

/**
 * Envoie des notifications par Expo Push (gratuit) et retire les jetons
 * d'appareils désinstallés. Renvoie le nombre de notifications acceptées.
 * Partagé par le fil (community/notify) et le planning (planning/notify).
 */
export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<number> {
  if (messages.length === 0) return 0;
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  }).catch(() => null);

  // Jetons désinstallés : retirés, pour ne plus les solliciter.
  const json = (await res?.json().catch(() => null)) as { data?: { status: string; details?: { error?: string } }[] } | null;
  const dead = (json?.data ?? [])
    .map((r, i) => (r.status === "error" && r.details?.error === "DeviceNotRegistered" ? messages[i].to : null))
    .filter((t): t is string => !!t);
  if (dead.length) await db.pushToken.deleteMany({ where: { token: { in: dead } } });
  return res?.ok ? messages.length - dead.length : 0;
}
