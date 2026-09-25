/**
 * Événements serveur envoyés à PostHog (même projet que l'app mobile, cf.
 * apps/mobile/src/lib/analytics.ts) — pour suivre ce que seul le serveur voit :
 * conversion essai → payant, annulations, expirations, échecs de paiement
 * (webhook RevenueCat). `distinctId` = id Supabase de l'utilisateur, que
 * l'app utilise aussi : les deux sources se rejoignent sur la même personne.
 *
 * Inactif sans `POSTHOG_KEY`. Best-effort : ne rejette jamais et abandonne
 * après 2 s, pour ne jamais retarder la réponse au webhook.
 */
export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties: Record<string, string | number | boolean | null | undefined> = {}
): Promise<void> {
  const apiKey = process.env.POSTHOG_KEY;
  if (!apiKey) return;
  const host = (process.env.POSTHOG_HOST || "https://eu.i.posthog.com").replace(/\/$/, "");
  try {
    await fetch(`${host}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: distinctId,
        properties: { ...properties, source: "server" },
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // best-effort
  }
}

/** Nom d'événement analytics pour un événement webhook RevenueCat, ou null
 * s'il n'a pas d'intérêt pour l'entonnoir. Pur, pour être testable. */
export function analyticsEventForRevenueCat(e: {
  type?: string;
  period_type?: string;
  is_trial_conversion?: boolean;
}): string | null {
  const trial = e.period_type === "TRIAL";
  switch (e.type) {
    case "INITIAL_PURCHASE":
      return trial ? "trial_started" : "subscription_started";
    case "RENEWAL":
      return e.is_trial_conversion ? "trial_converted" : "subscription_renewed";
    case "CANCELLATION":
      return trial ? "trial_cancelled" : "subscription_cancelled";
    case "UNCANCELLATION":
      return "subscription_uncancelled";
    case "EXPIRATION":
      return trial ? "trial_expired" : "subscription_expired";
    case "BILLING_ISSUE":
      return "billing_issue";
    case "PRODUCT_CHANGE":
      return "subscription_product_changed";
    default:
      return null;
  }
}
