import { useEffect, useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { PrimaryButton } from "@/components/onboarding";
import { Field } from "@/components/Field";
import { supabase } from "@/lib/supabase";

const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

/** Atteint uniquement via le lien de récupération de mot de passe (cf.
 * components/PasswordRecoveryListener.tsx, qui établit la session de
 * récupération avant de rediriger ici) — jamais depuis la navigation normale. */
export default function ResetPasswordScreen() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
  }, []);

  async function submit() {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      Alert.alert("Erreur", error.message);
      return;
    }

    Alert.alert("Mot de passe mis à jour", "Tu peux continuer.");
    router.replace("/(tabs)/today");
  }

  if (!ready) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-5 bg-background px-8">
        <Text className="text-center text-base text-muted">
          Ce lien n&apos;est plus valide. Demande un nouveau lien depuis l&apos;écran de connexion.
        </Text>
        <PrimaryButton label="Retour à la connexion" onPress={() => router.replace("/(auth)/login")} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 gap-5 px-5 pt-8">
        <View className="gap-2">
          <Text className="text-2xl font-extrabold tracking-tight text-text">Nouveau mot de passe</Text>
          <Text className="text-base text-muted">Choisis un nouveau mot de passe pour ton compte.</Text>
        </View>

        <Field label="Mot de passe">
          <TextInput
            className={INPUT}
            placeholder="6 caractères minimum"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </Field>
      </View>

      <View className="gap-3 px-5 pb-2 pt-3">
        <PrimaryButton
          label={loading ? "Mise à jour..." : "Mettre à jour"}
          disabled={loading || password.length < 6}
          onPress={submit}
        />
      </View>
    </SafeAreaView>
  );
}
