import { useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { PaywallView } from "@/components/PaywallView";
import { useSubscription, type SubscriptionPlan } from "@/subscription/store";
import { markOnboardingCompleted } from "@/onboarding/completion";
import { useOnboarding } from "@/onboarding/store";
import { persistOnboarding } from "@/onboarding/persist";

export default function OnboardingPaywall() {
  const { startTrial } = useSubscription();
  const { rider, horses } = useOnboarding();
  const [submitting, setSubmitting] = useState(false);

  async function finish() {
    await persistOnboarding(rider, horses);
    await markOnboardingCompleted();
    router.replace("/(tabs)/today");
  }

  async function onSubscribe(plan: SubscriptionPlan) {
    setSubmitting(true);
    try {
      // TODO: déclencher l'achat réel via RevenueCat (StoreKit/Play) avant de marquer l'essai.
      await startTrial(plan);
      await finish();
    } catch {
      Alert.alert("Oups", "Impossible de démarrer l'essai. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  // « Plus tard » : entre dans l'app en mode gaté (visuels/stats verrouillés).
  async function onClose() {
    setSubmitting(true);
    try {
      await finish();
    } catch {
      Alert.alert("Oups", "Impossible d'enregistrer ton profil. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  return <PaywallView onSubscribe={onSubscribe} onClose={onClose} submitting={submitting} />;
}
