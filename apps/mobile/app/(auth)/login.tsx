import { useState } from "react";
import { Alert, Image, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { PrimaryButton } from "@/components/onboarding";
import { Field } from "@/components/Field";
import { supabase } from "@/lib/supabase";
import { authenticateWithBiometrics, isBiometricLockEnabled } from "@/lib/biometrics";
import { getLocalDataOwner, setLocalDataOwner } from "@/lib/deviceOwner";
import { signInWithApple, useAppleSignInAvailable } from "@/lib/appleAuth";
import {
  pullCloudData,
  pullDocuments,
  pullAppointments,
  pullJournalEntries,
  pullTrainingSessions,
  pullExpenses,
} from "@/lib/cloudSync";
import { pullSharedHorses, pullPendingInvites } from "@/lib/sharing";
import { markOnboardingCompleted, resetOnboardingCompleted } from "@/onboarding/completion";
import { useHorses } from "@/horses/store";
import { useRiderProfile } from "@/rider/store";
import { useSessions } from "@/sessions/store";
import { useAgenda } from "@/agenda/store";
import { useGoals, pullAllGoals } from "@/goals/store";
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
        await supabase.auth.signOut();
        setLoading(false);
        Alert.alert("Connexion annulée", "Confirme ton identité pour te connecter.");
        return;
      }
    }

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
          clearSubscription(),
        ]);

        try {
          const cloudData = await pullCloudData();
          if (cloudData) {
            // Best-effort, ne lèvent jamais : cf. lib/cloudSync.ts et
            // lib/sharing.ts. Coffre-fort/calendrier/chevaux partagés sont
            // secondaires à l'écurie possédée/au profil — un échec ici ne
            // doit pas faire échouer toute la restauration.
            const [sharedHorses, documents, appointments, journalEntries, trainingSessions, expenses, goals] =
              await Promise.all([
                pullSharedHorses().catch(() => []),
                pullDocuments(),
                pullAppointments(),
                pullJournalEntries(),
                pullTrainingSessions(),
                pullExpenses(),
                pullAllGoals(),
              ]);

            hydrateFromCloud([...cloudData.horses, ...sharedHorses]);
            setRiderProfile(cloudData.rider);
            hydrateDocumentsFromCloud(documents);
            hydrateAppointmentsFromCloud(appointments);
            hydrateJournalFromCloud(journalEntries);
            hydrateSessionsFromCloud(trainingSessions);
            hydrateExpensesFromCloud(expenses);
            hydrateGoalsFromCloud(goals);

            await markOnboardingCompleted();
            await setLocalDataOwner(userId);
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

  async function signIn() {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (error) {
      setLoading(false);
      Alert.alert("Erreur", error.message);
      return;
    }

    await afterSuccessfulAuth(data.user?.id);
  }

  async function handleAppleSignIn() {
    setLoading(true);
    try {
      const result = await signInWithApple();
      if (result.cancelled) {
        setLoading(false);
        return;
      }
      await afterSuccessfulAuth(result.userId);
    } catch (e) {
      setLoading(false);
      Alert.alert("Erreur", e instanceof Error ? e.message : "Connexion avec Apple impossible.");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 gap-5 px-5 pt-8">
        <Image
          source={require("../../assets/icon.png")}
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
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={12}
              style={{ height: 48, width: "100%" }}
              onPress={handleAppleSignIn}
            />
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
