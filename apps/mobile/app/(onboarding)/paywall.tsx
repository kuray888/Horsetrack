import { router } from "expo-router";
import { PaywallView } from "@/components/PaywallView";
import { useSubscribeFlow, type SubscriptionPlan } from "@/subscription/store";
import { markOnboardingCompleted } from "@/onboarding/completion";
import { useOnboarding } from "@/onboarding/store";
import { useHorses } from "@/horses/store";
import { useRiderProfile } from "@/rider/store";

export default function OnboardingPaywall() {
  const { rider, horses } = useOnboarding();
  const { replaceHorses } = useHorses();
  const { setRiderProfile } = useRiderProfile();
  const { submitting, subscribe, restoring, restore } = useSubscribeFlow();

  async function finish() {
    // setRiderProfile()/replaceHorses() persistent localement ET poussent vers
    // le cloud en best-effort (cf. lib/cloudSync.ts).
    setRiderProfile(rider);
    replaceHorses(horses);
    // Le compte créé juste avant (cf. account.tsx) donne une session dans le
    // cas standard. Si la confirmation par email est activée côté Supabase, la
    // session n'existe pas encore et le push échoue silencieusement — il sera
    // retenté à la prochaine modification, ou au prochain login.
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

  return (
    <PaywallView
      onSubscribe={onSubscribe}
      onClose={onClose}
      onRestore={restore}
      submitting={submitting}
      restoring={restoring}
    />
  );
}
