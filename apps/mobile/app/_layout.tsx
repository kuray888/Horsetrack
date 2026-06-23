import "../global.css";
import { Stack } from "expo-router";
import { SubscriptionProvider } from "@/subscription/store";
import { ProgressProvider } from "@/progress/store";
import { HorsesProvider } from "@/horses/store";
import { RiderProfileProvider } from "@/rider/store";
import { ProgramProvider } from "@/program/store";
import { BadgeCelebration } from "@/components/BadgeCelebration";

export default function RootLayout() {
  return (
    <SubscriptionProvider>
      <RiderProfileProvider>
        <HorsesProvider>
          <ProgramProvider>
            <ProgressProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(onboarding)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
                <Stack.Screen name="coach-modal" options={{ presentation: "modal" }} />
                <Stack.Screen name="add-horse-modal" options={{ presentation: "modal" }} />
                <Stack.Screen name="edit-horse-modal" options={{ presentation: "modal" }} />
                <Stack.Screen name="edit-rider-modal" options={{ presentation: "modal" }} />
                <Stack.Screen name="session-detail-modal" options={{ presentation: "modal" }} />
              </Stack>
              <BadgeCelebration />
            </ProgressProvider>
          </ProgramProvider>
        </HorsesProvider>
      </RiderProfileProvider>
    </SubscriptionProvider>
  );
}
