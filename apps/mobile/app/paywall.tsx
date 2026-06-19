import { useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { PaywallView } from "@/components/PaywallView";
import { useSubscription, type SubscriptionPlan } from "@/subscription/store";

/** Paywall plein écran déclenché depuis l'app par un bouton « Débloquer » (<Locked>). */
export default function AppPaywall() {
  const { startTrial } = useSubscription();
  const [submitting, setSubmitting] = useState(false);

  async function onSubscribe(plan: SubscriptionPlan) {
    setSubmitting(true);
    try {
      // TODO: achat réel RevenueCat avant de marquer l'essai.
      await startTrial(plan);
      router.back();
    } catch {
      Alert.alert("Oups", "Impossible de démarrer l'essai. Réessaie.");
    } finally {
      setSubmitting(false);
    }
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
