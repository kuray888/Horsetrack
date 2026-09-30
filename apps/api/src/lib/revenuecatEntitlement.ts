/**
 * Traduction d'un événement webhook RevenueCat en état d'abonnement serveur
 * (rider_profiles) — logique pure, sans Prisma, pour être testée seule (cf.
 * revenuecatEntitlement.test.ts). Utilisée par api/revenuecat/webhook.
 */

/** Événements qui ouvrent (ou prolongent) l'accès Premium.
 *
 * `NON_RENEWING_PURCHASE` : c'est l'événement qu'envoie RevenueCat pour un
 * octroi promotionnel fait depuis le dashboard (ambassadeurs, « Premium
 * offert » — `store` et `period_type` valent alors "PROMOTIONAL"). Il manquait
 * à cette liste : l'événement tombait dans le `default` du webhook, était
 * marqué comme traité (dédoublonnage) sans rien écrire, et le compte restait
 * EXPIRED côté serveur alors que l'app affichait « Premium offert ». Toutes
 * les écritures gatées par rider_is_active_or_trialing (coffre-fort, 2ᵉ
 * cheval et au-delà — donc leurs séances, rendez-vous, journal) étaient
 * refusées en silence (cf. audit du 2026-09-30). La fin d'un octroi limité
 * dans le temps arrive, elle, par un événement EXPIRATION, déjà géré. */
export const GRANT_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "SUBSCRIPTION_EXTENDED",
  "NON_RENEWING_PURCHASE",
]);

export type RevenueCatEntitlementEvent = {
  type?: string;
  period_type?: string;
  store?: string;
  product_id?: string;
  expiration_at_ms?: number | null;
};

/** Best-effort : le SKU exact dépend des produits créés dans App Store Connect
 * / Play Console — à remplacer par un mapping exact une fois ces identifiants
 * connus (cf. mobile/src/subscription/store.tsx). */
export function billingPeriodFromProductId(productId: string | undefined): "MONTHLY" | "ANNUAL" | null {
  if (!productId) return null;
  const id = productId.toLowerCase();
  if (id.includes("annual") || id.includes("year")) return "ANNUAL";
  if (id.includes("month")) return "MONTHLY";
  return null;
}

/** Octroi promotionnel RevenueCat (sans achat store derrière). Même critère
 * que l'app (cf. mobile subscription/store.tsx, `store === "PROMOTIONAL"`). */
export function isPromotionalEvent(event: RevenueCatEntitlementEvent): boolean {
  return event.store === "PROMOTIONAL" || event.period_type === "PROMOTIONAL";
}

/** Champs d'abonnement à écrire pour un événement qui ouvre l'accès, ou null
 * si l'événement n'en ouvre pas (cf. GRANT_EVENT_TYPES). Un octroi
 * promotionnel est ACTIVE sans formule (`billingPeriod: null`), comme l'app le
 * représente déjà. */
export function grantFieldsForEvent(event: RevenueCatEntitlementEvent): {
  subscriptionTier: "GRAND_PRIX";
  subscriptionStatus: "ACTIVE" | "TRIALING";
  billingPeriod: "MONTHLY" | "ANNUAL" | null;
  trialEndsAt: Date | null;
} | null {
  if (!event.type || !GRANT_EVENT_TYPES.has(event.type)) return null;
  const promotional = isPromotionalEvent(event);
  const isTrial = !promotional && event.period_type === "TRIAL";
  return {
    subscriptionTier: "GRAND_PRIX",
    subscriptionStatus: isTrial ? "TRIALING" : "ACTIVE",
    billingPeriod: promotional ? null : billingPeriodFromProductId(event.product_id),
    trialEndsAt: isTrial && event.expiration_at_ms ? new Date(event.expiration_at_ms) : null,
  };
}
