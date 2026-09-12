import { useState } from "react";
import { Alert, Image, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { PrimaryButton } from "@/components/onboarding";
import { Field } from "@/components/Field";
import { supabase } from "@/lib/supabase";
import { authenticateWithBiometrics, isBiometricLockEnabled, setBiometricLockEnabled } from "@/lib/biometrics";
import { translateAuthError } from "@/lib/authErrors";
import { getLocalDataOwner, setLocalDataOwner } from "@/lib/deviceOwner";
import { signInWithApple, useAppleSignInAvailable } from "@/lib/appleAuth";
import {
  pullCloudData,
  pullDocuments,
  pullAppointments,
  pullJournalEntries,
  pullTrainingSessions,
  pullExpenses,
  pullWeightMeasurements,
} from "@/lib/cloudSync";
import { pullSharedHorses, pullPendingInvites } from "@/lib/sharing";
import { withTimeout } from "@/lib/withTimeout";
import { markOnboardingCompleted, resetOnboardingCompleted } from "@/onboarding/completion";
import { useHorses } from "@/horses/store";
import { useRiderProfile } from "@/rider/store";
import { useSessions } from "@/sessions/store";
import { useAgenda } from "@/agenda/store";
import { useGoals, pullAllGoals } from "@/goals/store";
import { useWeight } from "@/horses/weightStore";
import { useSubscription } from "@/subscription/store";

const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const appleAvailable = useAppleSignInAvailable();
  const { clearAll: clearHorses, hydrateFromCloud } = useHorses();
  const { clearAll: clearRiderProfile, setRiderProfile } = useRiderProfile();
  const { clearAll: clearSessions, hydrateFromCloud: hydrateSessionsFromCloud } = useSessions();
  const {
    clearAll: clearAgenda,
    hydrateDocumentsFromCloud,
    hydrateAppointmentsFromCloud,
    hydrateJournalFromCloud,
    hydrateExpensesFromCloud,
  } = useAgenda();
  const { clearAll: clearGoals, hydrateFromCloud: hydrateGoalsFromCloud } = useGoals();
  const { clearAll: clearWeight, hydrateFromCloud: hydrateWeightFromCloud } = useWeight();
  const { clearAll: clearSubscription } = useSubscription();

  // Affiche les invitations en attente (cf. lib/sharing.ts) juste après être
  // entré dans l'app, que ce soit après une restauration complète ou une
  // simple reconnexion sur un appareil qui a déjà les données du compte —
  // une invitation peut arriver à tout moment, pas seulement à la première
  // connexion sur un nouvel appareil.
  async function goToTodayOrInvites() {
    const invites = await pullPendingInvites().catch(() => []);
    router.replace("/(tabs)/today");
    if (invites.length > 0) router.push("/invites-modal");
  }

  // Partagé entre la connexion par mot de passe et Sign in with Apple — les
  // deux n'obtiennent une session Supabase que par des chemins différents,
  // tout ce qui suit (biométrie, restauration cloud) est identique ensuite.
  async function afterSuccessfulAuth(userId: string | undefined) {
    if (await isBiometricLockEnabled()) {
      const confirmed = await authenticateWithBiometrics("Confirmer avec Face ID");
      if (!confirmed) {
        setLoading(false);
        // Avant : déconnexion + alerte simple sans aucune issue — si la
        // biométrie devient indisponible (Face ID désactivé, capteur en
        // panne...), la connexion était bloquée en boucle, sans jamais
        // pouvoir atteindre Profil pour désactiver le réglage (cf. audit
        // pré-publication). "Désactiver le verrouillage" continue la
        // connexion déjà obtenue (mot de passe/Apple déjà validé) au lieu de
        // forcer une reconnexion.
        Alert.alert(
          "Confirmation impossible",
          "Ton identité n'a pas pu être confirmée (Face ID/Touch ID indisponible ou refusé). Tu peux réessayer, ou désactiver le verrouillage biométrique.",
          [
            { text: "Réessayer", style: "cancel", onPress: () => supabase.auth.signOut() },
            {
              text: "Désactiver le verrouillage",
              style: "destructive",
              onPress: async () => {
                await setBiometricLockEnabled(false);
                setLoading(true);
                await continueAfterAuth(userId);
              },
            },
          ]
        );
        return;
      }
    }

    await continueAfterAuth(userId);
  }

  async function continueAfterAuth(userId: string | undefined) {
    // L'abonnement (RevenueCat, pas encore branché) n'est pas sauvegardé dans
    // le cloud — si cet appareil a servi à un AUTRE compte avant, on le vide
    // pour ne pas le montrer à celui-ci. Écurie, profil cavalier, coffre-fort,
    // calendrier et séances planifiées, eux, sont sauvegardés (cf.
    // lib/cloudSync.ts) : un appareil qui n'a pas encore les données de CE
    // compte (nouveau téléphone, réinstallation...) essaie de les restaurer
    // plutôt que de renvoyer vers un onboarding qui écraserait tout.
    if (userId) {
      const owner = await getLocalDataOwner();
      if (owner !== userId) {
        await Promise.all([
          clearSessions(),
          clearAgenda(),
          clearGoals(),
          clearWeight(),
          clearSubscription(),
        ]);

        try {
          const cloudData = await withTimeout(
            pullCloudData(),
            15000,
            "La restauration de tes données prend plus de temps que prévu — vérifie ta connexion et réessaie."
          );
          if (cloudData) {
            // Best-effort, ne lèvent jamais : cf. lib/cloudSync.ts et
            // lib/sharing.ts. Coffre-fort/calendrier/chevaux partagés sont
            // secondaires à l'écurie possédée/au profil — un échec ici ne
            // doit pas faire échouer toute la restauration. Chaque pull
            // distingue par contre "aucune donnée" (`[]`) d'"échec réseau/RLS"
            // (`null`) — un domaine en échec n'est PAS hydraté du tout, pour ne
            // jamais écraser un vrai calendrier/coffre-fort/journal local avec
            // du vide (cf. audit du 2026-09-09 : c'était le cas avant, ce
            // bloc écrasait tout inconditionnellement).
            const [sharedHorses, documents, appointments, journalEntries, trainingSessions, expenses, goals, weightMeasurements] =
              await Promise.all([
                pullSharedHorses().catch(() => null),
                pullDocuments(),
                pullAppointments(),
                pullJournalEntries(),
                pullTrainingSessions(),
                pullExpenses(),
                pullAllGoals(),
                pullWeightMeasurements(),
              ]);

            hydrateFromCloud([...cloudData.horses, ...(sharedHorses ?? [])]);
            setRiderProfile(cloudData.rider);
            if (documents) hydrateDocumentsFromCloud(documents);
            if (appointments) hydrateAppointmentsFromCloud(appointments);
            if (journalEntries) hydrateJournalFromCloud(journalEntries);
            if (trainingSessions) hydrateSessionsFromCloud(trainingSessions);
            if (expenses) hydrateExpensesFromCloud(expenses);
            if (goals) hydrateGoalsFromCloud(goals);
            if (weightMeasurements) hydrateWeightFromCloud(weightMeasurements);

            await markOnboardingCompleted();
            await setLocalDataOwner(userId);

            const failedCount = [
              sharedHorses,
              documents,
              appointments,
              journalEntries,
              trainingSessions,
              expenses,
              goals,
              weightMeasurements,
            ].filter((v) => v === null).length;
            if (failedCount > 0) {
              Alert.alert(
                "Restauration partielle",
                "Certaines données n'ont pas pu être récupérées à cause d'une connexion instable — rien n'est perdu côté serveur, réessaie en te déconnectant puis reconnectant une fois le réseau meilleur."
              );
            }

            await goToTodayOrInvites();
            return;
          }
        } catch {
          // Échec réseau/serveur : on ne sait PAS si ce compte a déjà des
          // données distantes — surtout ne pas traiter ça comme "rien à
          // restaurer" (cf. pullCloudData), sous peine d'écraser/supprimer de
          // vraies données au prochain push (cf. lib/cloudSync.ts). On annule
          // la connexion plutôt que de repartir d'un état vide.
          setLoading(false);
          await supabase.auth.signOut();
          Alert.alert(
            "Connexion impossible",
            "Impossible de récupérer tes données pour l'instant. Vérifie ta connexion et réessaie."
          );
          return;
        }

        // pullCloudData() a répondu sans erreur réseau : ce compte n'a vraiment
        // jamais terminé l'onboarding. Comportement précédent, on repart d'une
        // écurie/d'un profil par défaut.
        await Promise.all([clearHorses(), clearRiderProfile(), resetOnboardingCompleted()]);
        await setLocalDataOwner(userId);
        router.replace("/(onboarding)/welcome");
        return;
      }
    }

    await goToTodayOrInvites();
  }

  async function resendConfirmationEmail() {
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
    Alert.alert(
      error ? "Erreur" : "Email envoyé",
      error ? translateAuthError(error.message) : "Un nouveau lien de confirmation vient de t'être envoyé."
    );
  }

  async function signIn() {
    setLoading(true);
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        12000,
        "Ça prend plus de temps que prévu — vérifie ta connexion et réessaie."
      );

      if (error) {
        // "Email not confirmed" a une vraie porte de sortie (renvoyer le lien)
        // plutôt qu'un simple message — sans compte confirmé, "Mot de passe
        // oublié" n'est pas garanti de fonctionner non plus (cf. audit
        // pré-publication).
        if (error.message.toLowerCase().includes("email not confirmed")) {
          Alert.alert("Email non confirmé", translateAuthError(error.message), [
            { text: "OK", style: "cancel" },
            { text: "Renvoyer l'email", onPress: resendConfirmationEmail },
          ]);
          return;
        }
        Alert.alert("Erreur", translateAuthError(error.message));
        return;
      }

      // Laisse le clavier (encore visible/en cours de fermeture juste après
      // l'appui sur "Se connecter") finir sa transition avant d'enchaîner sur
      // authenticateWithBiometrics() dans afterSuccessfulAuth (si le
      // verrouillage Face ID est activé) — même précaution que
      // handleAppleSignIn ci-dessous pour la feuille système Apple, jamais
      // appliquée ici jusqu'ici sous l'hypothèse que "le mot de passe n'a pas
      // de feuille système à laisser se fermer" : le clavier lui-même EST une
      // transition native du même genre (cf. crash reproduit à la connexion
      // par mot de passe le 2026-09-12, même signature que le crash Apple du
      // 2026-09-09 corrigé plus bas).
      await new Promise((resolve) => setTimeout(resolve, 400));
      await afterSuccessfulAuth(data.user?.id);
    } catch (e) {
      // Toute exception (réseau, erreur inattendue non renvoyée comme
      // `{ error }`) laissait ce bouton bloqué sur "Connexion..." — même
      // cause que le bouton "Création..." bloqué à l'inscription (cf.
      // (onboarding)/account.tsx, audit du 2026-09-06).
      Alert.alert(
        "Erreur",
        e instanceof Error ? translateAuthError(e.message) : "Connexion impossible pour l'instant. Vérifie ta connexion et réessaie."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleSignIn() {
    // AppleAuthenticationButton n'a pas de prop `disabled` (contrairement à
    // PrimaryButton ci-dessous) — sans cette garde, un second appui pendant
    // que le sheet natif Apple est encore à l'écran relance signInAsync() en
    // parallèle du premier appel, ce qu'iOS gère mal (cf. RequestUnknownException
    // + crash RCTFatal observés le 2026-09-09 sur un appui rapproché).
    if (loading) return;
    setLoading(true);
    try {
      const result = await signInWithApple();
      if (result.cancelled) {
        setLoading(false);
        return;
      }
      // Laisse la feuille système Apple finir sa transition de fermeture avant
      // d'enchaîner sur d'autres présentations/appels natifs (biométrie,
      // RevenueCat) — cf. crash récurrent "retour ~1s sur l'écran de connexion
      // puis crash silencieux" observé le 2026-09-09 sur plusieurs builds
      // malgré le durcissement complet des accès SecureStore. Aucun impact
      // perceptible pour l'utilisateur, spécifique au flux Apple (le mot de
      // passe n'a pas de feuille système à laisser se fermer).
      await new Promise((resolve) => setTimeout(resolve, 400));
      await afterSuccessfulAuth(result.userId);
    } catch (e) {
      setLoading(false);
      Alert.alert("Erreur", e instanceof Error ? translateAuthError(e.message) : "Connexion avec Apple impossible.");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 gap-5 px-5 pt-8">
        <Image
          source={require("../../assets/logo-mark.png")}
          style={{ width: 72, height: 72, alignSelf: "center" }}
          resizeMode="contain"
        />
        <View className="gap-2">
          <Text className="text-2xl font-display tracking-tight text-text">
            Connecte-toi à ton compte
          </Text>
          <Text className="text-base text-muted">Retrouve ton planning et ton suivi.</Text>
        </View>

        <Field label="Email">
          <TextInput
            className={INPUT}
            placeholder="toi@exemple.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />
        </Field>

        <Field label="Mot de passe">
          <TextInput
            className={INPUT}
            placeholder="Ton mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
          />
        </Field>

        <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password")} className="self-end">
          <Text className="text-sm font-semibold text-accent">Mot de passe oublié ?</Text>
        </TouchableOpacity>
      </View>

      <View className="gap-3 px-5 pb-2 pt-3">
        <PrimaryButton
          label={loading ? "Connexion..." : "Se connecter"}
          disabled={loading || !email.trim() || !password}
          onPress={signIn}
        />
        {appleAvailable ? (
          <>
            <View className="flex-row items-center gap-3">
              <View className="h-px flex-1 bg-border" />
              <Text className="text-xs text-muted">ou</Text>
              <View className="h-px flex-1 bg-border" />
            </View>
            {/* pointerEvents plutôt qu'une prop `disabled` : ce composant natif n'en
                expose pas — cf. la garde `if (loading) return` dans handleAppleSignIn,
                cette couche évite en plus que le tap n'atteigne le bouton natif. */}
            <View pointerEvents={loading ? "none" : "auto"} style={{ opacity: loading ? 0.6 : 1 }}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={12}
                style={{ height: 48, width: "100%" }}
                onPress={handleAppleSignIn}
              />
            </View>
          </>
        ) : null}
        <TouchableOpacity onPress={() => router.push("/(onboarding)/welcome")}>
          <Text className="text-center text-sm font-semibold text-accent">
            Pas encore de compte ? S&apos;inscrire
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
