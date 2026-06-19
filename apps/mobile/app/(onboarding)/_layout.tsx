import { Stack } from "expo-router";
import { OnboardingProvider } from "@/onboarding/store";

/** Groupe d'onboarding : monte le store partagé et masque les headers. */
export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
    </OnboardingProvider>
  );
}
