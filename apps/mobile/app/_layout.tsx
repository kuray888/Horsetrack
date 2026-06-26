import "../global.css";
import { Stack } from "expo-router";
import { SubscriptionProvider } from "@/subscription/store";
import { ProgressProvider } from "@/progress/store";
import { HorsesProvider } from "@/horses/store";
import { RiderProfileProvider } from "@/rider/store";
import { WeatherProvider } from "@/weather/store";
import { ProgramProvider } from "@/program/store";
import { AgendaProvider } from "@/agenda/store";
import { GoalsProvider } from "@/goals/store";
import { BadgeCelebration } from "@/components/BadgeCelebration";
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
                        <Stack.Screen name="bilan-modal" options={{ presentation: "modal" }} />
                        <Stack.Screen name="goal-modal" options={{ presentation: "modal" }} />
                      </Stack>
                      <BadgeCelebration />
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
