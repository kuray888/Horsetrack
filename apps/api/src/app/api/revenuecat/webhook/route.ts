import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, Prisma, SubscriptionStatus, SubscriptionTier } from "@cheval/db";

/**
 * Entitlement RevenueCat du palier payant unique — doit correspondre
 * exactement à celui créé dans le dashboard (cf.
 * apps/mobile/src/lib/revenuecat.ts). Pivot tarifaire du 2026-09-03 : plus
 * de distinction Paddock/Grand Prix, un seul entitlement (`grand_prix`,
 * réutilisé tel quel pour ne pas dépendre d'une reconfiguration store).
 */
const ENTITLEMENT_ID = "grand_prix";
const ENTITLEMENT_EXTRA_HORSE = "extra_horse";

// Tous les champs restent optionnels (au lieu de `required`) pour ne pas
// transformer un event sans entitlement pertinent — déjà ignoré plus bas via
// `event?.app_user_id` — en rejet 400 : seule la FORME des champs présents
// est vérifiée (ex: `id` doit être une string si fourni), pas leur présence.
const eventSchema = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  app_user_id: z.string().optional(),
  event_timestamp_ms: z.number().optional(),
  entitlement_ids: z.array(z.string()).optional(),
  period_type: z.enum(["TRIAL", "INTRO", "NORMAL"]).optional(),
  product_id: z.string().optional(),
  expiration_at_ms: z.number().nullable().optional(),
});

type RevenueCatEvent = z.infer<typeof eventSchema>;

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
 * Un même événement peut concerner le palier payant (grand_prix) et/ou
 * l'add-on cheval supplémentaire (extra_horse) — ce sont des entitlements
 * indépendants, chacun mis à jour seulement s'il apparaît dans `entitlement_ids`.
 * Limite connue : si plusieurs entitlements évoluent dans des événements
 * séparés et proches, il n'y a pas de réconciliation fine entre eux au-delà
 * de ce que chaque événement porte individuellement — acceptable, zéro
 * abonné réel à ce jour.
 *
 * Idempotence et ordre : RevenueCat garantit une livraison "at-least-once",
 * sans garantie d'ordre. `RevenueCatWebhookEvent` déduplique par `event.id`
 * (le même événement rejoué deux fois ne s'applique qu'une fois) ;
 * `rider_profiles.lastWebhookEventAt` empêche en plus un événement plus
 * ancien (retry tardif, ex. une CANCELLATION livrée en retard) d'écraser un
 * état déjà mis à jour par un événement plus récent (ex. un RENEWAL).
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
    const parsed = eventSchema.safeParse(body.event ?? {});
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    event = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const entitlementIds = event?.entitlement_ids ?? [];
  const hasEntitlement = entitlementIds.includes(ENTITLEMENT_ID);
  const hasExtraHorse = entitlementIds.includes(ENTITLEMENT_EXTRA_HORSE);

  if (!event?.app_user_id || (!hasEntitlement && !hasExtraHorse)) {
    return NextResponse.json({ received: true });
  }

  // RevenueCat redélivre un event tant qu'on ne répond pas 200 (timeout réseau
  // côté nous, par ex.) — `create` sur la PK fait office de claim atomique :
  // si cet `event.id` est déjà passé, P2002 et on sort sans re-traiter.
  if (event.id) {
    try {
      await db.revenueCatWebhookEvent.create({ data: { id: event.id } });
    } catch (e) {
      const alreadyProcessed = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (alreadyProcessed) return NextResponse.json({ received: true });
      throw e;
    }
  }

  const userId = event.app_user_id;
  const tier: SubscriptionTier | null = hasEntitlement ? SubscriptionTier.GRAND_PRIX : null;
  // Anti-réordonnancement (cf. audit sécurité) : RevenueCat garantit une
  // livraison "at-least-once" mais pas l'ordre — sans cette garde, un retry
  // tardif d'un événement périmé (ex. une CANCELLATION livrée en retard)
  // pourrait écraser un état déjà mis à jour par un événement plus récent
  // (ex. un RENEWAL). Sans event_timestamp_ms (absent du payload), on ne
  // peut pas garantir l'ordre, donc on applique quand même (comportement
  // inchangé) — le dedup par event.id ci-dessus reste la protection contre
  // le rejeu exact du même événement.
  const eventTimestamp = event.event_timestamp_ms ? new Date(event.event_timestamp_ms) : null;
  const orderingWhere = eventTimestamp
    ? { OR: [{ lastWebhookEventAt: null }, { lastWebhookEventAt: { lt: eventTimestamp } }] }
    : {};

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
        where: { userId, ...orderingWhere },
        data: { revenuecatId: userId, ...tierFields, ...addonFields, lastWebhookEventAt: eventTimestamp ?? undefined },
      });
      break;
    }
    case "CANCELLATION": {
      const tierFields = tier ? { subscriptionStatus: SubscriptionStatus.CANCELLED } : {};
      const addonFields = hasExtraHorse ? { extraHorseSlots: 0 } : {};
      await db.riderProfile.updateMany({
        where: { userId, ...orderingWhere },
        data: { ...tierFields, ...addonFields, lastWebhookEventAt: eventTimestamp ?? undefined },
      });
      break;
    }
    case "EXPIRATION": {
      const tierFields = tier ? { subscriptionStatus: SubscriptionStatus.EXPIRED } : {};
      const addonFields = hasExtraHorse ? { extraHorseSlots: 0 } : {};
      await db.riderProfile.updateMany({
        where: { userId, ...orderingWhere },
        data: { ...tierFields, ...addonFields, lastWebhookEventAt: eventTimestamp ?? undefined },
      });
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
