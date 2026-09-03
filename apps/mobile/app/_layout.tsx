import "../global.css";
import { useEffect } from "react";
import { Alert } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";

// Garde le splash natif affiché tant que la police d'affichage n'est pas
// chargée — sans ça, les titres (font-display) flasheraient un instant dans
// la police système avant de basculer, à chaque démarrage de l'app.
SplashScreen.preventAutoHideAsync().catch(() => {});

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
import { ThemeProvider } from "@/theme/ThemeProvider";
import { SubscriptionProvider } from "@/subscription/store";
import { HorsesProvider } from "@/horses/store";
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
          </HorsesProvider>
        </RiderProfileProvider>
      </SubscriptionProvider>
    </GlossaryProvider>
    </PickerOverlayProvider>
    </ThemeProvider>
  );
}
