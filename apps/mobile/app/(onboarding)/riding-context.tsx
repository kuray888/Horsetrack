import { router } from "expo-router";
import { OnboardingShell, SingleSelect } from "@/components/onboarding";
import { useOnboarding } from "@/onboarding/store";
import { RIDING_CONTEXTS, TOTAL_STEPS } from "@/onboarding/options";

/** Cf. audit du 2026-09-16, section onboarding : adapte le vocabulaire de
 * l'app au rapport réel de l'utilisateur avec le(s) cheval(aux) (propriétaire,
 * demi-pension, club) plutôt que de ne parler que de "ton écurie". Placée en
 * première question du profil cavalier — elle cadre les questions suivantes
 * plus qu'elle n'en dépend. */
export default function RidingContext() {
  const { rider, setRider } = useOnboarding();
  return (
    <OnboardingShell
      step={1}
      total={TOTAL_STEPS}
      title="Tu montes..."
      subtitle="Ça nous aide à parler de ton cheval comme il faut."
      ctaDisabled={!rider.ridingContext}
      onNext={() => router.push("/(onboarding)/rider-level")}
    >
      <SingleSelect
        options={RIDING_CONTEXTS}
        value={rider.ridingContext}
        onChange={(ridingContext) => setRider({ ridingContext })}
      />
    </OnboardingShell>
  );
}
