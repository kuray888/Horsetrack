import { supabase } from "@/lib/supabase";

/**
 * Prévient l'équipe d'un événement du planning (cf. apps/api
 * planning/notify) : séance attribuée, « a monté », séance annulée, nouveau
 * créneau. Le serveur relit la ligne et choisit destinataires et texte.
 *
 * L'écriture part par la file de synchro et peut ne pas être encore
 * arrivée : tant que le serveur répond « introuvable », on réessaie un peu
 * plus tard (le serveur ne prévient qu'une fois par événement et par
 * personne). Best-effort : hors ligne, la notification est perdue, pas la
 * donnée.
 */

export type PlanningNotifyEvent = "assigned" | "done" | "cancelled" | "slot_assigned";

const RETRY_DELAYS_MS = [3_000, 15_000, 60_000];

async function send(kind: "session" | "slot", id: string, event: PlanningNotifyEvent): Promise<number | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/planning/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ kind, id, event }),
  });
  return res.status;
}

export function notifyPlanning(kind: "session" | "slot", id: string, event: PlanningNotifyEvent): void {
  let attempt = 0;
  const run = () => {
    send(kind, id, event)
      .then((status) => {
        if (status === 404 && attempt < RETRY_DELAYS_MS.length) {
          setTimeout(run, RETRY_DELAYS_MS[attempt++]);
        }
      })
      .catch(() => {
        if (attempt < RETRY_DELAYS_MS.length) setTimeout(run, RETRY_DELAYS_MS[attempt++]);
      });
  };
  setTimeout(run, RETRY_DELAYS_MS[attempt++]);
}
