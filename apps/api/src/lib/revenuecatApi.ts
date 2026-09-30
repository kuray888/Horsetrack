import { billingPeriodFromProductId } from "@/lib/revenuecatEntitlement";

/**
 * Accès serveur à l'API REST RevenueCat (v1), avec la clé SECRÈTE du projet
 * (`REVENUECAT_SECRET_API_KEY`, dashboard RevenueCat → Project settings → API
 * keys → Secret API keys). Jamais exposée à l'app.
 *
 * Pourquoi : le webhook seul ne suffit pas à garder rider_profiles fidèle à
 * RevenueCat (cf. audit du 2026-09-30) — un événement perdu ou mal traité
 * (octroi promotionnel, TRANSFER qui ne porte ni app_user_id ni
 * entitlement_ids…) laissait un compte Premium dans l'app mais gratuit pour le
 * serveur, sans rattrapage possible. Ici, on relit l'état de vérité.
 *
 * Sans la clé, tout est inerte (null / false) : aucune route n'échoue pour ça.
 */

const API = "https://api.revenuecat.com/v1";
const ENTITLEMENT_ID = "grand_prix";

export type EntitlementGrant = {
  subscriptionTier: "GRAND_PRIX";
  subscriptionStatus: "ACTIVE" | "TRIALING";
  billingPeriod: "MONTHLY" | "ANNUAL" | null;
  trialEndsAt: Date | null;
};

/** `active: false` = RevenueCat ne voit aucun accès Premium en cours. */
export type EntitlementState = { active: true; grant: EntitlementGrant } | { active: false };

type SubscriberPayload = {
  subscriber?: {
    entitlements?: Record<
      string,
      { expires_date?: string | null; grace_period_expires_date?: string | null; product_identifier?: string }
    >;
    subscriptions?: Record<string, { period_type?: string; store?: string }>;
  };
};

function secretKey(): string | null {
  return process.env.REVENUECAT_SECRET_API_KEY || null;
}

/** Vrai si la clé secrète est configurée pour cet environnement. */
export function isRevenueCatApiConfigured(): boolean {
  return secretKey() !== null;
}

/** Identifiants anonymes RevenueCat ($RCAnonymousID:…) : aucun compte
 * Horsetrack derrière, rien à synchroniser. */
export function isAnonymousAppUserId(id: string): boolean {
  return id.startsWith("$RCAnonymousID:");
}

/** Lecture pure de la réponse `GET /subscribers/{id}` — testée seule. */
export function entitlementStateFromSubscriber(payload: SubscriberPayload, now = Date.now()): EntitlementState {
  const entitlement = payload.subscriber?.entitlements?.[ENTITLEMENT_ID];
  if (!entitlement) return { active: false };
  const until = (d: string | null | undefined) => (d ? Date.parse(d) : NaN);
  const active =
    entitlement.expires_date == null ||
    until(entitlement.expires_date) > now ||
    until(entitlement.grace_period_expires_date) > now;
  if (!active) return { active: false };

  const productId = entitlement.product_identifier ?? "";
  const subscription = payload.subscriber?.subscriptions?.[productId];
  const promotional = subscription?.store === "promotional" || productId.startsWith("rc_promo");
  const trial = !promotional && subscription?.period_type === "trial";
  return {
    active: true,
    grant: {
      subscriptionTier: "GRAND_PRIX",
      subscriptionStatus: trial ? "TRIALING" : "ACTIVE",
      billingPeriod: promotional ? null : billingPeriodFromProductId(productId),
      trialEndsAt: trial && entitlement.expires_date ? new Date(entitlement.expires_date) : null,
    },
  };
}

/** État Premium d'un compte selon RevenueCat, ou null si inconnu (clé absente,
 * erreur réseau/API) — un null ne doit jamais être interprété comme « pas
 * d'accès ». */
export async function fetchEntitlementState(appUserId: string): Promise<EntitlementState | null> {
  const key = secretKey();
  if (!key || isAnonymousAppUserId(appUserId)) return null;
  try {
    const res = await fetch(`${API}/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn("[revenuecat:api] lecture abonné échouée", res.status);
      return null;
    }
    return entitlementStateFromSubscriber((await res.json()) as SubscriberPayload);
  } catch (e) {
    console.warn("[revenuecat:api] lecture abonné échouée", e);
    return null;
  }
}

/** Supprime le client RevenueCat (historique d'achats, attributs) à la
 * suppression du compte — la politique de confidentialité promet qu'il ne
 * reste rien. N'affecte pas un abonnement Apple/Google en cours (géré par le
 * store). Best-effort : vrai si supprimé ou déjà absent. */
export async function deleteRevenueCatCustomer(appUserId: string): Promise<boolean> {
  const key = secretKey();
  if (!key) return false;
  try {
    const res = await fetch(`${API}/subscribers/${encodeURIComponent(appUserId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok || res.status === 404;
  } catch (e) {
    console.warn("[revenuecat:api] suppression client échouée", e);
    return false;
  }
}
