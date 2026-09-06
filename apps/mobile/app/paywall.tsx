import { router } from "expo-router";
import { PaywallView } from "@/components/PaywallView";
import { useSubscribeFlow, useSubscription, type BillingPeriod } from "@/subscription/store";

/** Paywall plein écran déclenché depuis l'app par un bouton « Débloquer » (<Locked>). */
export default function AppPaywall() {
  const { submitting, subscribe, restoring, restore } = useSubscribeFlow();
  const { redeemPromoCode } = useSubscription();

  async function onSubscribe(period: BillingPeriod) {
    await subscribe(period, () => router.back());
  }

  return (
    <PaywallView
      onSubscribe={onSubscribe}
      onClose={() => router.back()}
      onRestore={restore}
      onRedeemPromoCode={redeemPromoCode}
      submitting={submitting}
      restoring={restoring}
    />
  );
}
