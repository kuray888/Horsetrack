import { router } from "expo-router";
import { OnboardingShell, SingleSelect } from "@/components/onboarding";
import { useOnboarding } from "@/onboarding/store";
import { RIDER_GOALS, TOTAL_STEPS } from "@/onboarding/options";

export default function Goal() {
  const { rider, setRider } = useOnboarding();
  return (
    <OnboardingShell
      step={4}
      total={TOTAL_STEPS}
      title="Ton objectif principal ?"
      subtitle="C'est lui qui guidera ton programme."
      ctaDisabled={!rider.primaryGoal}
      onNext={() => router.push("/(onboarding)/horse-basics")}
    >
      <SingleSelect
        options={RIDER_GOALS}
        value={rider.primaryGoal}
        onChange={(primaryGoal) => setRider({ primaryGoal })}
      />
    </OnboardingShell>
  );
}
