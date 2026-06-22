import { router } from "expo-router";
import { PaywallView } from "@/components/PaywallView";
import { useSubscribeFlow, type SubscriptionPlan } from "@/subscription/store";
import { markOnboardingCompleted } from "@/onboarding/completion";
import { useOnboarding } from "@/onboarding/store";
import { useHorses } from "@/horses/store";
import { useRiderProfile } from "@/rider/store";
import { persistOnboarding } from "@/onboarding/persist";

export default function OnboardingPaywall() {
  const { rider, horses } = useOnboarding();
  const { replaceHorses } = useHorses();
  const { setRiderProfile } = useRiderProfile();
  const { submitting, subscribe } = useSubscribeFlow();

  async function finish() {
    // Stores locaux : source de vérité tant que la session Supabase n'est pas
    // réimposée au démarrage (cf. commentaire dans app/index.tsx).
    setRiderProfile(rider);
    replaceHorses(horses);
    // Best-effort : suppose une session déjà ouverte (l'onboarding n'impose plus
    // de créer un compte avant le paywall) — échoue silencieusement sinon.
    persistOnboarding(rider, horses).catch(() => {});

    await markOnboardingCompleted();
    router.replace("/(tabs)/today");
  }

  async function onSubscribe(plan: SubscriptionPlan) {
    await subscribe(plan, finish);
  }

  // « Plus tard » : entre dans l'app en mode gaté (visuels/stats verrouillés).
  function onClose() {
    finish();
  }

  return <PaywallView onSubscribe={onSubscribe} onClose={onClose} submitting={submitting} />;
}
