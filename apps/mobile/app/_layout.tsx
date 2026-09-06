import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";

// Garde le splash natif affiché tant que la police d'affichage n'est pas
// chargée — sans ça, les titres (font-display) flasheraient un instant dans
// la police système avant de basculer, à chaque démarrage de l'app.
SplashScreen.preventAutoHideAsync().catch(() => {});

import { ThemeProvider } from "@/theme/ThemeProvider";
import { SubscriptionProvider } from "@/subscription/store";
import { HorsesProvider } from "@/horses/store";
import { WeightProvider } from "@/horses/weightStore";
import { RiderProfileProvider } from "@/rider/store";
import { WeatherProvider } from "@/weather/store";
import { SessionsProvider } from "@/sessions/store";
import { AgendaProvider } from "@/agenda/store";
import { GoalsProvider } from "@/goals/store";
import { BiometricGate } from "@/components/BiometricGate";
import { PasswordRecoveryListener } from "@/components/PasswordRecoveryListener";
import { GlossaryProvider } from "@/glossary/GlossaryProvider";
import { PickerOverlayProvider } from "@/components/PickerOverlay";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
    <PickerOverlayProvider>
    <GlossaryProvider>
      <SubscriptionProvider>
        <RiderProfileProvider>
          <HorsesProvider>
            <WeightProvider>
            <WeatherProvider>
              <AgendaProvider>
                <SessionsProvider>
                  <GoalsProvider>
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="index" />
                      <Stack.Screen name="(auth)" />
                      <Stack.Screen name="(onboarding)" />
                      <Stack.Screen name="(tabs)" />
                      <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
                      <Stack.Screen name="add-horse-modal" options={{ presentation: "modal" }} />
                      <Stack.Screen name="edit-horse-modal" options={{ presentation: "modal" }} />
                      <Stack.Screen name="share-horse-modal" options={{ presentation: "modal" }} />
                      <Stack.Screen name="invites-modal" options={{ presentation: "modal" }} />
                      <Stack.Screen name="edit-rider-modal" options={{ presentation: "modal" }} />
                      <Stack.Screen name="goal-modal" options={{ presentation: "modal" }} />
                      <Stack.Screen name="change-password-modal" options={{ presentation: "modal" }} />
                      <Stack.Screen name="reset-password" />
                    </Stack>
                    <PasswordRecoveryListener />
                    <BiometricGate />
                  </GoalsProvider>
                </SessionsProvider>
              </AgendaProvider>
            </WeatherProvider>
            </WeightProvider>
          </HorsesProvider>
        </RiderProfileProvider>
      </SubscriptionProvider>
    </GlossaryProvider>
    </PickerOverlayProvider>
    </ThemeProvider>
  );
}
