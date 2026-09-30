import { supabase } from "@/lib/supabase";

/**
 * Demande au serveur de relire le statut Premium chez RevenueCat (cf. api
 * /api/subscription/sync) — appelé quand RevenueCat dit à l'app que le compte
 * est Premium. Filet du webhook : sans lui, un événement perdu ou non traité
 * laissait l'app afficher Premium pendant que le serveur refusait chevaux,
 * coffre-fort et séances (cf. audit du 2026-09-30).
 *
 * Une synchro réussie par compte et par lancement suffit ; un échec (profil
 * pas encore créé pendant l'onboarding, réseau) laisse retenter au prochain
 * appel. Best-effort, ne rejette jamais.
 */
const syncedUserIds = new Set<string>();
let inFlight: Promise<void> | null = null;

export function requestServerSubscriptionSync(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session || syncedUserIds.has(session.user.id)) return;
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/subscription/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = (await res.json().catch(() => null)) as { synced?: boolean } | null;
      if (res.ok && json?.synced) syncedUserIds.add(session.user.id);
    } catch (e) {
      console.warn("[subscriptionSync] resynchronisation serveur échouée", e);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
