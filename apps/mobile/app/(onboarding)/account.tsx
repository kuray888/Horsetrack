import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { PrimaryButton } from "@/components/onboarding";
import { Field } from "@/components/Field";
import { supabase } from "@/lib/supabase";

const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

export default function OnboardingAccount() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function createAccount() {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    setLoading(false);

    if (error) {
      Alert.alert("Erreur", error.message);
      return;
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
      </View>

      <View className="gap-3 px-5 pb-2 pt-3">
        <PrimaryButton
          label={loading ? "Création..." : "Créer mon compte"}
          disabled={loading || !email.trim() || password.length < 6}
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
