import { router } from "expo-router";
import { OnboardingShell, SingleSelect } from "@/components/onboarding";
import { useOnboarding } from "@/onboarding/store";
import { RIDER_LEVELS, TOTAL_STEPS } from "@/onboarding/options";
import { t } from "@/i18n";

export default function RiderLevel() {
  const { rider, setRider } = useOnboarding();
  return (
    <OnboardingShell
      step={1}
      total={TOTAL_STEPS}
      title={t("Quel cavalier es-tu ?")}
      subtitle={t("Ça reste dans ton profil cavalier.")}
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
