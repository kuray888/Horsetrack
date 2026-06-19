import "../global.css";
// import { StripeProvider } from "@stripe/stripe-react-native";
import { Stack } from "expo-router";
import { SubscriptionProvider } from "@/subscription/store";
import { ProgressProvider } from "@/progress/store";
import { HorsesProvider } from "@/horses/store";
import { BadgeCelebration } from "@/components/BadgeCelebration";

// TODO: StripeProvider désactivé temporairement pour tester dans Expo Go classique
// (le module natif @stripe/stripe-react-native n'y est pas embarqué). À restaurer
// avant de tester paiements/Apple Pay réels ou de builder un dev client/prod.
export default function RootLayout() {
  return (
    <SubscriptionProvider>
      <ProgressProvider>
        <HorsesProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
            <Stack.Screen name="coach-modal" options={{ presentation: "modal" }} />
            <Stack.Screen name="add-horse-modal" options={{ presentation: "modal" }} />
          </Stack>
          <BadgeCelebration />
        </HorsesProvider>
      </ProgressProvider>
    </SubscriptionProvider>
  );
}
