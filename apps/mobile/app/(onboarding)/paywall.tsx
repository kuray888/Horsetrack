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
    // Best-effort : le compte créé juste avant (cf. account.tsx) donne une session
    // dans le cas standard. Si la confirmation par email est activée côté Supabase,
    // la session n'existe pas encore et cet appel échoue silencieusement — la
    // synchronisation se fera à la prochaine connexion.
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
