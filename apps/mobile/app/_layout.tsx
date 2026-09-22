// Placé avant tout autre import : l'origine des mesures de démarrage est
// l'évaluation de ce module-là, donc plus il est évalué tôt, moins la mesure
// rate de travail (cf. lib/startupTrace.ts).
import { startupTrace, formatTrace, summarizeTrace } from "@/lib/startupTrace";
import "../global.css";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { Stack } from "expo-router";
import * as Sentry from "@sentry/react-native";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";

// Garde le splash natif affiché tant que la police d'affichage n'est pas
// chargée — sans ça, les titres (font-display) flasheraient un instant dans
// la police système avant de basculer, à chaque démarrage de l'app.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Sans DSN configurée (dev local, ou avant la mise en place du compte
// Sentry), le SDK se désactive silencieusement tout seul — aucun impact.
// Capture les erreurs JS fatales AVANT qu'elles ne deviennent un crash natif
// opaque (RCTFatal/SIGABRT) — cf. les crashs TestFlight des 2026-09-07/08,
// diagnostiqués à l'aveugle faute de vraie trace JS.
if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  });
}

import { installGlobalErrorHandler, recordCrash } from "@/lib/crashLog";
import { LastCrashNotice } from "@/components/LastCrashNotice";

// Complément à Sentry.ErrorBoundary ci-dessous : capture les exceptions
// fatales qui échappent au rendu React (callback, timer, continuation de
// promesse) — cf. lib/crashLog.ts. Fonctionne même sans Sentry configuré.
installGlobalErrorHandler();

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
import { CrashFallback } from "@/components/CrashFallback";
import { retryPendingWrites } from "@/lib/cloudSync";

function RootLayout() {
  const [fontsLoaded] = useFonts({ BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  // Repères de démarrage. Deux instants suffisent ici : le reste de la mesure
  // vient des lectures de fichiers, instrumentées à la source dans
  // lib/localStore.ts. `marked` est une ref et non un état : marquer ne doit
  // rien redessiner, sinon la mesure changerait ce qu'elle mesure.
  //
  // Les deux noms sont choisis pour ne pas mentir. Le premier passage ici suit
  // un rendu qui a renvoyé `null` (cf. le garde-fou `if (!fontsLoaded)` plus
  // bas) : rien n'est encore à l'écran, le splash natif tient toujours. La
  // première frame réellement peinte est celle qui suit le chargement de la
  // police, d'où la seconde marque.
  const marked = useRef({ mount: false, painted: false });
  useEffect(() => {
    if (!marked.current.mount) {
      marked.current.mount = true;
      startupTrace.mark("montage du layout racine (écran encore vide)");
    }
    if (fontsLoaded && !marked.current.painted) {
      marked.current.painted = true;
      startupTrace.mark("police chargée, première frame avec contenu");
    }
  }, [fontsLoaded]);

  // Rapport automatique en développement seulement. Le délai laisse aux
  // lectures des stores le temps de finir : les publier plus tôt donnerait un
  // tableau à moitié vide, qu'on lirait à tort comme un démarrage rapide. En
  // production, rien n'est journalisé — les mesures restent lisibles à la
  // demande depuis l'écran Profil.
  useEffect(() => {
    if (!__DEV__) return;
    const timer = setTimeout(() => {
      console.log(
        ["[démarrage] mesures (origine : premier module JS)", formatTrace(startupTrace.report()), ...summarizeTrace(startupTrace.report())].join(
          "\n"
        )
      );
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Rejoue les écritures cloud restées en attente d'un retour du réseau (cf.
  // lib/syncQueue.ts) : au démarrage, puis à chaque retour de l'app au premier
  // plan — c'est le moment où le téléphone a le plus de chances d'avoir
  // retrouvé du réseau (sortie du manège, du van, d'un sous-sol). Pas de
  // détection de connectivité dédiée : elle demanderait une dépendance de
  // plus pour, au mieux, déclencher les mêmes reprises un peu plus tôt.
  useEffect(() => {
    retryPendingWrites().catch(() => {});
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") retryPendingWrites().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => <CrashFallback error={error} resetError={resetError} />}
      onError={(error) => recordCrash(error, false)}
    >
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
                      <Stack.Screen name="document-viewer" options={{ presentation: "fullScreenModal", animation: "fade" }} />
                      <Stack.Screen name="add-horse-modal" options={{ presentation: "modal" }} />
                      <Stack.Screen name="edit-horse-modal" options={{ presentation: "modal" }} />
                      <Stack.Screen name="share-horse-modal" options={{ presentation: "modal" }} />
                      <Stack.Screen name="invites-modal" options={{ presentation: "modal" }} />
                      <Stack.Screen name="edit-rider-modal" options={{ presentation: "modal" }} />
                      <Stack.Screen name="goal-modal" options={{ presentation: "modal" }} />
                      <Stack.Screen name="session-note-modal" options={{ presentation: "modal" }} />
                      <Stack.Screen name="search" options={{ presentation: "modal" }} />
                      <Stack.Screen name="change-password-modal" options={{ presentation: "modal" }} />
                      <Stack.Screen name="reset-password" />
                    </Stack>
                    <PasswordRecoveryListener />
                    <BiometricGate />
                    <LastCrashNotice />
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
    </Sentry.ErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);
