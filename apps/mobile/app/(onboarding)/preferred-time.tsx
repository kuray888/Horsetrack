import { router } from "expo-router";
import { OnboardingShell, SingleSelect } from "@/components/onboarding";
import { useOnboarding } from "@/onboarding/store";
import { PREFERRED_TIMES, TOTAL_STEPS } from "@/onboarding/options";

export default function PreferredTimeScreen() {
  const { rider, setRider } = useOnboarding();
  return (
    <OnboardingShell
      step={4}
      total={TOTAL_STEPS}
      title="À quel moment montes-tu, en général ?"
      subtitle="Pour caler l'horaire des séances sur ton emploi du temps réel."
      ctaDisabled={!rider.preferredTime}
      onNext={() => router.push("/(onboarding)/goal")}
    >
      <SingleSelect
        options={PREFERRED_TIMES}
        value={rider.preferredTime}
        onChange={(preferredTime) => setRider({ preferredTime })}
      />
    </OnboardingShell>
  );
}
