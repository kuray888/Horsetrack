import { router } from "expo-router";
import { OnboardingShell, SingleSelect } from "@/components/onboarding";
import { useOnboarding } from "@/onboarding/store";
import { DISCIPLINES, TOTAL_STEPS } from "@/onboarding/options";

export default function DisciplineStep() {
  const { rider, setRider } = useOnboarding();
  return (
    <OnboardingShell
      step={2}
      total={TOTAL_STEPS}
      title="Ta discipline principale ?"
      subtitle="Celle que tu pratiques le plus souvent."
      ctaDisabled={!rider.mainDiscipline}
      onNext={() => router.push("/(onboarding)/frequency")}
    >
      <SingleSelect
        options={DISCIPLINES}
        value={rider.mainDiscipline}
        onChange={(mainDiscipline) => setRider({ mainDiscipline })}
      />
    </OnboardingShell>
  );
}
