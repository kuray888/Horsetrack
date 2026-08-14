import "../global.css";
import { Alert } from "react-native";
import { Stack } from "expo-router";

// Capture les erreurs JS fatales pour diagnostiquer les crashs au démarrage.
// À supprimer une fois le crash identifié et corrigé.
// Important : on ne relaie PAS prev() pour les erreurs fatales — c'est ce
// relais qui appelle NativeExceptionsManager.reportFatal côté natif et
// déclenche un abort() immédiat (RCTFatal), avant même que l'Alert ait pu
// s'afficher à l'écran. En release/TestFlight il n'y a pas de red box : une
// exception JS non catchée fait planter l'app par design.
if (typeof ErrorUtils !== "undefined") {
  const prev = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((err, isFatal) => {
    Alert.alert(
      isFatal ? "Fatal JS Error" : "JS Error",
      `${err?.message ?? "unknown"}\n\n${String(err?.stack ?? "").slice(0, 600)}`
    );
    if (!isFatal) {
      prev?.(err, isFatal);
    }
  });
}
import { SubscriptionProvider } from "@/subscription/store";
import { ProgressProvider } from "@/progress/store";
import { HorsesProvider } from "@/horses/store";
import { RiderProfileProvider } from "@/rider/store";
import { WeatherProvider } from "@/weather/store";
import { ProgramProvider } from "@/program/store";
import { AgendaProvider } from "@/agenda/store";
import { GoalsProvider } from "@/goals/store";
import { CurriculumEngine } from "@/program/CurriculumEngine";
import { BadgeCelebration } from "@/components/BadgeCelebration";
import { BiometricGate } from "@/components/BiometricGate";
import { PasswordRecoveryListener } from "@/components/PasswordRecoveryListener";
import { GlossaryProvider } from "@/glossary/GlossaryProvider";
import { PickerOverlayProvider } from "@/components/PickerOverlay";

export default function RootLayout() {
  return (
    <PickerOverlayProvider>
    <GlossaryProvider>
      <SubscriptionProvider>
        <RiderProfileProvider>
          <HorsesProvider>
            <WeatherProvider>
              {/* AgendaProvider doit englober ProgramProvider : le moteur de
                  programme lit les rendez-vous (repos auto après un rendez-vous
                  vétérinaire) et la météo (allègement en cas de forte chaleur),
                  cf. program/store.tsx. */}
              <AgendaProvider>
                <ProgramProvider>
                  <ProgressProvider>
                    <GoalsProvider>
                      <CurriculumEngine />
                      <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="index" />
                        <Stack.Screen name="(auth)" />
                        <Stack.Screen name="(onboarding)" />
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
                        <Stack.Screen name="coach-modal" options={{ presentation: "modal" }} />
                        <Stack.Screen name="add-horse-modal" options={{ presentation: "modal" }} />
                        <Stack.Screen name="edit-horse-modal" options={{ presentation: "modal" }} />
                        <Stack.Screen name="share-horse-modal" options={{ presentation: "modal" }} />
                        <Stack.Screen name="invites-modal" options={{ presentation: "modal" }} />
                        <Stack.Screen name="edit-rider-modal" options={{ presentation: "modal" }} />
                        <Stack.Screen name="session-detail-modal" options={{ presentation: "modal" }} />
                        <Stack.Screen name="session-active-modal" options={{ presentation: "fullScreenModal" }} />
                        <Stack.Screen name="bilan-modal" options={{ presentation: "modal" }} />
                        <Stack.Screen name="goal-modal" options={{ presentation: "modal" }} />
                        <Stack.Screen name="change-password-modal" options={{ presentation: "modal" }} />
                        <Stack.Screen name="reset-password" />
                      </Stack>
                      <BadgeCelebration />
                      <PasswordRecoveryListener />
                      <BiometricGate />
                    </GoalsProvider>
                  </ProgressProvider>
                </ProgramProvider>
              </AgendaProvider>
            </WeatherProvider>
          </HorsesProvider>
        </RiderProfileProvider>
      </SubscriptionProvider>
    </GlossaryProvider>
    </PickerOverlayProvider>
  );
}
