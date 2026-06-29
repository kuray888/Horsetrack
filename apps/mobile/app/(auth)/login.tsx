import { useState } from "react";
import { Alert, Image, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { PrimaryButton } from "@/components/onboarding";
import { Field } from "@/components/Field";
import { supabase } from "@/lib/supabase";
import { authenticateWithBiometrics, isBiometricLockEnabled } from "@/lib/biometrics";
import { getLocalDataOwner, setLocalDataOwner } from "@/lib/deviceOwner";
import {
  pullCloudData,
  pullDocuments,
  pullAppointments,
  pullJournalEntries,
  pullAllHorseProgress,
  pullAllHorsePrograms,
} from "@/lib/cloudSync";
import { pullSharedHorses, pullPendingInvites } from "@/lib/sharing";
import { markOnboardingCompleted, resetOnboardingCompleted } from "@/onboarding/completion";
import { useHorses } from "@/horses/store";
import { useRiderProfile } from "@/rider/store";
import { useProgress } from "@/progress/store";
import { useProgram } from "@/program/store";
import { useAgenda } from "@/agenda/store";
import { useGoals, pullAllGoals } from "@/goals/store";
import { useSubscription } from "@/subscription/store";

const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { clearAll: clearHorses, hydrateFromCloud } = useHorses();
  const { clearAll: clearRiderProfile, setRiderProfile } = useRiderProfile();
  const { clearAll: clearProgress, hydrateFromCloud: hydrateProgressFromCloud } = useProgress();
  const { clearAll: clearProgram, hydrateFromCloud: hydrateProgramFromCloud } = useProgram();
  const { clearAll: clearAgenda, hydrateDocumentsFromCloud, hydrateAppointmentsFromCloud, hydrateJournalFromCloud } =
    useAgenda();
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

  async function signIn() {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (error) {
      setLoading(false);
      Alert.alert("Erreur", error.message);
      return;
    }

    if (await isBiometricLockEnabled()) {
      const confirmed = await authenticateWithBiometrics("Confirmer avec Face ID");
      if (!confirmed) {
        await supabase.auth.signOut();
        setLoading(false);
        Alert.alert("Connexion annulée", "Confirme ton identité pour te connecter.");
        return;
      }
    }

    setLoading(false);

    // L'abonnement (RevenueCat, pas encore branché) n'est pas sauvegardé dans
    // le cloud — si cet appareil a servi à un AUTRE compte avant, on le vide
    // pour ne pas le montrer à celui-ci. Écurie, profil cavalier, coffre-fort,
    // calendrier, progression et programme, eux, sont sauvegardés (cf.
    // lib/cloudSync.ts) : un appareil qui n'a pas encore les données de CE
    // compte (nouveau téléphone, réinstallation...) essaie de les restaurer
    // plutôt que de renvoyer vers un onboarding qui écraserait tout.
    const userId = data.user?.id;
    if (userId) {
      const owner = await getLocalDataOwner();
      if (owner !== userId) {
        await Promise.all([
          clearProgress(),
          clearProgram(),
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
            // doit pas faire échouer toute la restauration. Tout est récupéré
            // EN PARALLÈLE puis appliqué d'un seul bloc synchrone ci-dessous
            // (pas d'await entre les hydrateFromCloud) : si l'écurie/le profil
            // étaient appliqués avant que le programme le soit, le moteur de
            // programme (program/store.tsx, effet d'auto-génération) verrait
            // un cheval sans programme entre les deux et en regénérerait un
            // vide, écrasant la vraie restauration cloud.
            const [sharedHorses, documents, appointments, journalEntries, progressByHorse, programsByHorse, goals] =
              await Promise.all([
                pullSharedHorses().catch(() => []),
                pullDocuments(),
                pullAppointments(),
                pullJournalEntries(),
                pullAllHorseProgress(),
                pullAllHorsePrograms(),
                pullAllGoals(),
              ]);

            hydrateFromCloud([...cloudData.horses, ...sharedHorses]);
            setRiderProfile(cloudData.rider);
            hydrateDocumentsFromCloud(documents);
            hydrateAppointmentsFromCloud(appointments);
            hydrateJournalFromCloud(journalEntries);
            hydrateProgressFromCloud(progressByHorse);
            hydrateProgramFromCloud(programsByHorse);
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

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 gap-5 px-5 pt-8">
        <Image
          source={require("../../assets/icon.png")}
          style={{ width: 72, height: 72, alignSelf: "center" }}
          resizeMode="contain"
        />
        <View className="gap-2">
          <Text className="text-2xl font-extrabold tracking-tight text-text">
            Connecte-toi à ton compte
          </Text>
          <Text className="text-base text-muted">Retrouve ton programme et ton suivi.</Text>
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
        <TouchableOpacity onPress={() => router.push("/(onboarding)/welcome")}>
          <Text className="text-center text-sm font-semibold text-accent">
            Pas encore de compte ? S&apos;inscrire
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
