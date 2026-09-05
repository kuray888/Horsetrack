import { router } from "expo-router";
import { OnboardingShell, SingleSelect } from "@/components/onboarding";
import { useOnboarding } from "@/onboarding/store";
import { RIDER_LEVELS, TOTAL_STEPS } from "@/onboarding/options";

export default function RiderLevel() {
  const { rider, setRider } = useOnboarding();
  return (
    <OnboardingShell
      step={1}
      total={TOTAL_STEPS}
      title="Quel cavalier es-tu ?"
      subtitle="On adapte le contenu et la difficulté à ton niveau."
      ctaDisabled={!rider.level}
      onNext={() => router.push("/(onboarding)/discipline")}
    >
      <SingleSelect
        options={RIDER_LEVELS}
        value={rider.level}
        onChange={(level) => setRider({ level })}
      />
    </OnboardingShell>
  );
}
