import { router } from "expo-router";
import { PaywallView } from "@/components/PaywallView";
import { useSubscribeFlow, type BillingPeriod } from "@/subscription/store";
import type { PaidTier } from "@/lib/revenuecat";

/** Paywall plein écran déclenché depuis l'app par un bouton « Débloquer » (<Locked>). */
export default function AppPaywall() {
  const { submitting, subscribe, purchaseAddon, restoring, restore } = useSubscribeFlow();

  async function onSubscribe(tier: PaidTier, period: BillingPeriod) {
    await subscribe(tier, period, () => router.back());
  }

  async function onPurchaseAddon(period: BillingPeriod) {
    await purchaseAddon(period, () => router.back());
  }

  return (
    <PaywallView
      onSubscribe={onSubscribe}
      onClose={() => router.back()}
      onRestore={restore}
      onPurchaseAddon={onPurchaseAddon}
      submitting={submitting}
      restoring={restoring}
      title="Débloque tout l'accès"
    />
  );
}
