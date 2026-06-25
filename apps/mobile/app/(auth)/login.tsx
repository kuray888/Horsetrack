import { useState } from "react";
import { Alert, Image, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { PrimaryButton } from "@/components/onboarding";
import { Field } from "@/components/Field";
import { supabase } from "@/lib/supabase";
import { authenticateWithBiometrics, isBiometricLockEnabled } from "@/lib/biometrics";
import { getLocalDataOwner, setLocalDataOwner } from "@/lib/deviceOwner";
import { pullCloudData, pullDocuments } from "@/lib/cloudSync";
import { markOnboardingCompleted, resetOnboardingCompleted } from "@/onboarding/completion";
import { useHorses } from "@/horses/store";
import { useRiderProfile } from "@/rider/store";
import { useProgress } from "@/progress/store";
import { useProgram } from "@/program/store";
import { useAgenda } from "@/agenda/store";
import { useGoals } from "@/goals/store";
import { useSubscription } from "@/subscription/store";

const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { clearAll: clearHorses, hydrateFromCloud } = useHorses();
  const { clearAll: clearRiderProfile, setRiderProfile } = useRiderProfile();
  const { clearAll: clearProgress } = useProgress();
  const { clearAll: clearProgram } = useProgram();
  const { clearAll: clearAgenda, hydrateDocumentsFromCloud } = useAgenda();
  const { clearAll: clearGoals } = useGoals();
  const { clearAll: clearSubscription } = useSubscription();

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

    // Progression/agenda/abo ne sont pas sauvegardés dans le cloud (cf.
    // lib/cloudSync.ts) — si cet appareil a servi à un AUTRE compte avant, on
    // les vide pour ne pas les montrer à celui-ci. Écurie + profil cavalier,
    // eux, sont sauvegardés : un appareil qui n'a pas encore les données de CE
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
            hydrateFromCloud(cloudData.horses);
            setRiderProfile(cloudData.rider);
            // Best-effort, ne lève jamais : cf. lib/cloudSync.ts. Le coffre-fort
            // est secondaire à l'écurie possédée/au profil — un échec ici ne
            // doit pas faire échouer toute la restauration.
            hydrateDocumentsFromCloud(await pullDocuments());
            await markOnboardingCompleted();
            await setLocalDataOwner(userId);
            router.replace("/(tabs)/today");
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

    router.replace("/(tabs)/today");
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
