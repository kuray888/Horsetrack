// Placé avant tout autre import : l'origine des mesures de démarrage est
// l'évaluation de ce module-là, donc plus il est évalué tôt, moins la mesure
// rate de travail (cf. lib/startupTrace.ts).
import { startupTrace, formatTrace, summarizeTrace } from "@/lib/startupTrace";
import "../global.css";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Sentry from "@sentry/react-native";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useFonts, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { TrialLifecycleSync } from "@/subscription/TrialLifecycleSync";
import { startAnalytics } from "@/lib/analytics";
import { markFirstSeen } from "@/lib/reviewPrompt";
import { CloudRefreshProvider } from "@/lib/cloudRefresh";

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

import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";
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
import { NotificationRouter } from "@/components/NotificationRouter";
import { SessionReminders } from "@/sessions/SessionReminders";
import { GlossaryProvider } from "@/glossary/GlossaryProvider";
import { PickerOverlayProvider } from "@/components/PickerOverlay";
import { CrashFallback } from "@/components/CrashFallback";
import { retryPendingWrites } from "@/lib/cloudSync";
import { registerPushToken } from "@/lib/pushRegistration";
import { supabase } from "@/lib/supabase";
// Importé dès le démarrage : la tâche GPS de la séance en direct doit être
// déclarée avant qu'iOS ou Android ne lui livre des positions (cf. recorder.ts).
import { restoreRide } from "@/rides/recorder";
import { initRideSafety } from "@/rides/safety";

// Analytics produit (cf. lib/analytics.ts) : inactives sans clé PostHog.
startAnalytics();
markFirstSeen();

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
      const report = startupTrace.report();
      console.log(
        [
          "[démarrage] mesures (origine : premier module JS)",
          formatTrace(report),
          ...summarizeTrace(report),
          // Les écritures sont synchrones (cf. lib/localStore.ts) : ce sont
          // elles, pas les lectures, qui bloquent le thread JS.
          ...summarizeTrace(report, "écriture "),
        ].join("\n")
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
  // Séance en direct interrompue (app fermée par le système pendant la
  // balade) : reprise au lancement, avec la surveillance de sécurité.
  useEffect(() => {
    initRideSafety();
    restoreRide().catch(() => {});
  }, []);

  useEffect(() => {
    retryPendingWrites().catch(() => {});
    // Jeton push du fil privé : seulement si les notifications sont déjà
    // autorisées (cf. lib/pushRegistration.ts), jamais demandé ici.
    registerPushToken().catch(() => {});
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next !== "active") return;
      retryPendingWrites().catch(() => {});
      registerPushToken().catch(() => {});
    });
    const auth = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") registerPushToken().catch(() => {});
    });
    return () => {
      sub.remove();
      auth.data.subscription.unsubscribe();
    };
  }, []);

  if (!fontsLoaded) return null;

  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => <CrashFallback error={error} resetError={resetError} />}
      onError={(error) => recordCrash(error, false)}
    >
    {/* Racine des gestes (balayage des cartes, cf. components/SwipeableRow) :
        doit envelopper tout l'arbre pour que les gestes y soient reconnus. */}
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider>
    <PickerOverlayProvider>
    <GlossaryProvider>
      <SubscriptionProvider>
        <TrialLifecycleSync />
        <RiderProfileProvider>
          <HorsesProvider>
            <WeightProvider>
            <WeatherProvider>
              <AgendaProvider>
                <SessionsProvider>
                  <GoalsProvider>
                  <CloudRefreshProvider>
                    <AppStack />
                    {/* Icônes de la barre système (heure, batterie) : foncées sur
                        les palettes claires, claires en mode sombre. Toujours
                        explicites : sans consigne, la barre suit le mode du
                        téléphone et pouvait passer en blanc sur blanc quand
                        l'app restait claire (cf. ThemeProvider). */}
                    <ThemedStatusBar />
                    <PasswordRecoveryListener />
                    {/* Toucher un rappel ouvre l'écran concerné. */}
                    <NotificationRouter />
                    {/* Rappels de séance et leurs boutons « C'est fait » /
                        « Reporter à demain ». */}
                    <SessionReminders />
                    <BiometricGate />
                    <LastCrashNotice />
                  </CloudRefreshProvider>
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
    </GestureHandlerRootView>
    </Sentry.ErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);

/** Pile racine. Fond des écrans aux couleurs du thème : sans lui, les
 * transitions laissaient voir un instant le gris clair par défaut, très
 * visible en mode sombre. */
function AppStack() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
      <Stack.Screen name="premium-welcome" options={{ presentation: "modal" }} />
      <Stack.Screen name="document-viewer" options={{ presentation: "fullScreenModal", animation: "fade" }} />
      <Stack.Screen name="add-horse-modal" options={{ presentation: "modal" }} />
      <Stack.Screen name="edit-horse-modal" options={{ presentation: "modal" }} />
      <Stack.Screen name="share-horse-modal" options={{ presentation: "modal" }} />
      <Stack.Screen name="invites-modal" options={{ presentation: "modal" }} />
      <Stack.Screen name="edit-rider-modal" options={{ presentation: "modal" }} />
      <Stack.Screen name="goal-modal" options={{ presentation: "modal" }} />
      <Stack.Screen name="session-note-modal" options={{ presentation: "modal" }} />
      <Stack.Screen name="ride" options={{ presentation: "modal" }} />
      <Stack.Screen name="contacts" options={{ presentation: "modal" }} />
      <Stack.Screen name="referral" options={{ presentation: "modal" }} />
      <Stack.Screen name="coach" options={{ presentation: "modal" }} />
      <Stack.Screen name="comments" options={{ presentation: "modal" }} />
      <Stack.Screen name="library" options={{ presentation: "modal" }} />
      <Stack.Screen name="search" options={{ presentation: "modal" }} />
      <Stack.Screen name="change-password-modal" options={{ presentation: "modal" }} />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="auth-callback" options={{ animation: "none" }} />
    </Stack>
  );
}

function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === "dark" ? "light" : "dark"} />;
}
