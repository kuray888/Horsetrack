import { useState } from "react";
import { Alert, Image, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { PrimaryButton } from "@/components/onboarding";
import { Field } from "@/components/Field";
import { supabase } from "@/lib/supabase";

const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendResetLink() {
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: "horsetrack://reset-password",
    });
    setLoading(false);

    // Même message succès ou échec côté Supabase (y compris email inconnu en
    // base) : ne jamais laisser deviner si un email existe ou non.
    Alert.alert(
      "Vérifie tes emails",
      "Si un compte existe avec cette adresse, un lien de réinitialisation vient de t'être envoyé."
    );
    if (!error) router.back();
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
          <Text className="text-2xl font-display tracking-tight text-text">Mot de passe oublié</Text>
          <Text className="text-base text-muted">
            Indique ton email, on t&apos;envoie un lien pour le réinitialiser.
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
            autoComplete="email"
            textContentType="emailAddress"
          />
        </Field>
      </View>

      <View className="gap-3 px-5 pb-2 pt-3">
        <PrimaryButton
          label={loading ? "Envoi..." : "Envoyer le lien"}
          disabled={loading || !email.trim()}
          onPress={sendResetLink}
        />
      </View>
    </SafeAreaView>
  );
}
