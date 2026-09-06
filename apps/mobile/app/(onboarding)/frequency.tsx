import { router } from "expo-router";
import { OnboardingShell, SingleSelect } from "@/components/onboarding";
import { useOnboarding } from "@/onboarding/store";
import { RIDE_FREQUENCIES, TOTAL_STEPS } from "@/onboarding/options";

export default function Frequency() {
  const { rider, setRider } = useOnboarding();
  return (
    <OnboardingShell
      step={3}
      total={TOTAL_STEPS}
      title="À quelle fréquence montes-tu ?"
      subtitle="Ça reste dans ton profil cavalier."
      ctaDisabled={!rider.rideFrequency}
      onNext={() => router.push("/(onboarding)/goal")}
    >
      <SingleSelect
        options={RIDE_FREQUENCIES}
        value={rider.rideFrequency}
        onChange={(rideFrequency) => setRider({ rideFrequency })}
      />
    </OnboardingShell>
  );
}
