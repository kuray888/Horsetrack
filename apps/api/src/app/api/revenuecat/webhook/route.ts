import { NextRequest, NextResponse } from "next/server";
import { db, SubscriptionStatus, SubscriptionTier } from "@cheval/db";

/**
 * Entitlements RevenueCat — doivent correspondre exactement à ceux créés dans
 * le dashboard (cf. apps/mobile/src/lib/revenuecat.ts). Le produit Grand Prix
 * est rattaché aux DEUX entitlements `paddock` et `grand_prix` (sur-ensemble).
 */
const ENTITLEMENT_PADDOCK = "paddock";
const ENTITLEMENT_GRAND_PRIX = "grand_prix";
const ENTITLEMENT_EXTRA_HORSE = "extra_horse";

type RevenueCatEvent = {
  type: string;
  app_user_id: string;
  entitlement_ids?: string[];
  period_type?: "TRIAL" | "INTRO" | "NORMAL";
  product_id?: string;
  expiration_at_ms?: number | null;
};

/** Best-effort : le SKU exact dépend des produits créés dans App Store Connect
 * / Play Console (pas encore le cas) — à remplacer par un mapping exact une
 * fois ces identifiants connus (cf. mobile/src/subscription/store.tsx). */
function billingPeriodFromProductId(productId: string | undefined): "MONTHLY" | "ANNUAL" | null {
  if (!productId) return null;
  const id = productId.toLowerCase();
  if (id.includes("annual") || id.includes("year")) return "ANNUAL";
  if (id.includes("month")) return "MONTHLY";
  return null;
}

/**
 * Webhook RevenueCat (Project Settings > Webhooks) — source de vérité pour
 * l'entitlement abonnement. RevenueCat envoie le secret configuré dans le
 * dashboard via le header Authorization ; on le compare ici. `app_user_id`
 * est l'id Supabase Auth (cf. Purchases.logIn côté mobile), qui est aussi
 * `rider_profiles.userId` (le trigger `handle_new_user` recopie l'uuid
 * Supabase en texte dans public.users.id — cf. rls.sql).
 *
 * Un même événement peut concerner le palier (paddock/grand_prix) et/ou
 * l'add-on cheval supplémentaire (extra_horse) — ce sont des entitlements
 * indépendants, chacun mis à jour seulement s'il apparaît dans `entitlement_ids`.
 * Limite connue : si plusieurs entitlements évoluent dans des événements
 * séparés et proches, il n'y a pas de réconciliation fine entre eux au-delà
 * de ce que chaque événement porte individuellement — acceptable, zéro
 * abonné réel à ce jour.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.REVENUECAT_WEBHOOK_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let event: RevenueCatEvent;
  try {
    const body = await req.json();
    event = body.event;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const entitlementIds = event?.entitlement_ids ?? [];
  const hasGrandPrix = entitlementIds.includes(ENTITLEMENT_GRAND_PRIX);
  const hasPaddock = entitlementIds.includes(ENTITLEMENT_PADDOCK);
  const hasExtraHorse = entitlementIds.includes(ENTITLEMENT_EXTRA_HORSE);

  if (!event?.app_user_id || (!hasGrandPrix && !hasPaddock && !hasExtraHorse)) {
    return NextResponse.json({ received: true });
  }

  const userId = event.app_user_id;
  const tier: SubscriptionTier | null = hasGrandPrix
    ? SubscriptionTier.GRAND_PRIX
    : hasPaddock
      ? SubscriptionTier.PADDOCK
      : null;

  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "SUBSCRIPTION_EXTENDED": {
      const isTrial = event.period_type === "TRIAL";
      const tierFields = tier
        ? {
            subscriptionTier: tier,
            subscriptionStatus: isTrial ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE,
            billingPeriod: billingPeriodFromProductId(event.product_id),
            trialEndsAt: isTrial && event.expiration_at_ms ? new Date(event.expiration_at_ms) : null,
          }
        : {};
      const addonFields = hasExtraHorse ? { extraHorseSlots: 1 } : {};
      await db.riderProfile.updateMany({
        where: { userId },
        data: { revenuecatId: userId, ...tierFields, ...addonFields },
      });
      break;
    }
    case "CANCELLATION": {
      const tierFields = tier ? { subscriptionStatus: SubscriptionStatus.CANCELLED } : {};
      const addonFields = hasExtraHorse ? { extraHorseSlots: 0 } : {};
      await db.riderProfile.updateMany({ where: { userId }, data: { ...tierFields, ...addonFields } });
      break;
    }
    case "EXPIRATION": {
      const tierFields = tier ? { subscriptionStatus: SubscriptionStatus.EXPIRED } : {};
      const addonFields = hasExtraHorse ? { extraHorseSlots: 0 } : {};
      await db.riderProfile.updateMany({ where: { userId }, data: { ...tierFields, ...addonFields } });
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
