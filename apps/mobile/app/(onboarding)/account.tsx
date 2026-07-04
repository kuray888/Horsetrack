import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { PrimaryButton } from "@/components/onboarding";
import { Field } from "@/components/Field";
import { supabase } from "@/lib/supabase";
import { getLocalDataOwner, setLocalDataOwner } from "@/lib/deviceOwner";
import { useProgress } from "@/progress/store";
import { useProgram } from "@/program/store";
import { useAgenda } from "@/agenda/store";
import { useGoals } from "@/goals/store";
import { useSubscription } from "@/subscription/store";

const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

export default function OnboardingAccount() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  // Horses/rider sont déjà écrasés par les réponses d'onboarding à l'étape
  // paywall (cf. (onboarding)/paywall.tsx) — seuls ces trois-là ne le sont
  // jamais et resteraient ceux d'un compte précédent sur cet appareil.
  const { clearAll: clearProgress } = useProgress();
  const { clearAll: clearProgram } = useProgram();
  const { clearAll: clearAgenda } = useAgenda();
  const { clearAll: clearGoals } = useGoals();
  const { clearAll: clearSubscription } = useSubscription();

  async function createAccount() {
    if (password !== confirmPassword) {
      Alert.alert("Erreur", "Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);

    // Si une tentative précédente a déjà créé ce compte (signUp réussi) mais
    // que l'app a été interrompue avant la fin du paywall (cf. (onboarding)/
    // paywall.tsx — seul endroit qui appelle markOnboardingCompleted()), on a
    // déjà une session ici : app/index.tsx renvoie vers l'onboarding tant que
    // ce flag n'est pas posé, donc on repasse forcément par cet écran. Re-
    // appeler signUp() échouerait alors avec "email déjà utilisé" sans porte
    // de sortie. On poursuit directement plutôt que de re-créer un compte.
    const { data: existing } = await supabase.auth.getSession();
    if (existing.session) {
      setLoading(false);
      router.push("/(onboarding)/paywall");
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    setLoading(false);

    if (error) {
      const message = /already registered|already exists/i.test(error.message)
        ? "Un compte existe déjà avec cet email — connecte-toi plutôt."
        : error.message;
      Alert.alert("Erreur", message);
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      const owner = await getLocalDataOwner();
      if (owner && owner !== userId) {
        await Promise.all([clearProgress(), clearProgram(), clearAgenda(), clearGoals(), clearSubscription()]);
      }
      await setLocalDataOwner(userId);
    }

    // Si le projet Supabase exige une confirmation par email, signUp() ne renvoie
    // pas de session tout de suite. On continue malgré tout vers le paywall (au
    // lieu de renvoyer vers le login) pour ne pas perdre les réponses d'onboarding :
    // elles sont sauvegardées en local à l'étape paywall quoi qu'il arrive, et la
    // synchronisation Supabase se fera dès qu'une session existera.
    if (!data.session) {
      Alert.alert(
        "Vérifie tes emails",
        "Un lien de confirmation t'a été envoyé. Tu peux continuer dès maintenant."
      );
    }

    router.push("/(onboarding)/paywall");
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 gap-5 px-5 pt-8">
        <View className="gap-2">
          <Text className="text-2xl font-extrabold tracking-tight text-text">
            Crée ton compte pour sauvegarder ton programme
          </Text>
          <Text className="text-base text-muted">
            Tes réponses et ton programme seront liés à ce compte.
          </Text>
        </View>

        <Field label="Email">
          <TextInput
            className={INPUT}
            placeholder="toi@exemple.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </Field>

        <Field label="Mot de passe">
          <TextInput
            className={INPUT}
            placeholder="6 caractères minimum"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </Field>

        <Field label="Confirmer le mot de passe">
          <TextInput
            className={INPUT}
            placeholder="Retape ton mot de passe"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
          {passwordsMismatch ? (
            <Text className="text-xs text-red-500">Les mots de passe ne correspondent pas.</Text>
          ) : null}
        </Field>
      </View>

      <View className="gap-3 px-5 pb-2 pt-3">
        <PrimaryButton
          label={loading ? "Création..." : "Créer mon compte"}
          disabled={loading || !email.trim() || password.length < 6 || password !== confirmPassword}
          onPress={createAccount}
        />
        <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
          <Text className="text-center text-sm font-semibold text-accent">
            Déjà un compte ? Se connecter
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
