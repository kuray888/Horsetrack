import { router } from "expo-router";
import { PaywallView } from "@/components/PaywallView";
import { useSubscribeFlow, type SubscriptionPlan } from "@/subscription/store";

/** Paywall plein écran déclenché depuis l'app par un bouton « Débloquer » (<Locked>). */
export default function AppPaywall() {
  const { submitting, subscribe } = useSubscribeFlow();

  async function onSubscribe(plan: SubscriptionPlan) {
    await subscribe(plan, () => router.back());
  }

  return (
    <PaywallView
      onSubscribe={onSubscribe}
      onClose={() => router.back()}
      submitting={submitting}
      title="Débloque tout l'accès"
    />
  );
}
