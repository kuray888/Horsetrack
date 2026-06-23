import { NextRequest, NextResponse } from "next/server";
import { db } from "@cheval/db";

/**
 * Entitlement déclenché par un abonnement Cheval — doit correspondre
 * exactement à l'entitlement créé dans le dashboard RevenueCat.
 */
const ENTITLEMENT_ID = "premium";

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
function planFromProductId(productId: string | undefined): "MONTHLY" | "ANNUAL" | undefined {
  if (!productId) return undefined;
  const id = productId.toLowerCase();
  if (id.includes("annual") || id.includes("year")) return "ANNUAL";
  if (id.includes("month")) return "MONTHLY";
  return undefined;
}

/**
 * Webhook RevenueCat (Project Settings > Webhooks) — source de vérité pour
 * l'entitlement abonnement. RevenueCat envoie le secret configuré dans le
 * dashboard via le header Authorization ; on le compare ici. `app_user_id`
 * est l'id Supabase Auth (cf. Purchases.logIn côté mobile), qui est aussi
 * `rider_profiles.userId` (le trigger `handle_new_user` recopie l'uuid
 * Supabase en texte dans public.users.id — cf. rls.sql).
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

  if (!event?.app_user_id || !event.entitlement_ids?.includes(ENTITLEMENT_ID)) {
    return NextResponse.json({ received: true });
  }

  const userId = event.app_user_id;
  const plan = planFromProductId(event.product_id);

  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "SUBSCRIPTION_EXTENDED": {
      const isTrial = event.period_type === "TRIAL";
      await db.riderProfile.updateMany({
        where: { userId },
        data: {
          subscriptionStatus: isTrial ? "TRIALING" : "ACTIVE",
          subscriptionPlan: plan,
          trialEndsAt: isTrial && event.expiration_at_ms ? new Date(event.expiration_at_ms) : null,
          revenuecatId: userId,
        },
      });
      break;
    }
    case "CANCELLATION":
      await db.riderProfile.updateMany({ where: { userId }, data: { subscriptionStatus: "CANCELLED" } });
      break;
    case "EXPIRATION":
      await db.riderProfile.updateMany({ where: { userId }, data: { subscriptionStatus: "EXPIRED" } });
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
