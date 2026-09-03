import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { PrimaryButton } from "@/components/onboarding";
import { Field } from "@/components/Field";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme/colors";

const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

export default function ChangePasswordModal() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const canSave = password.length >= 6 && password === confirm;

  async function submit() {
    if (!canSave) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      Alert.alert("Erreur", error.message);
      return;
    }

    Alert.alert("Mot de passe modifié", "Ton mot de passe a bien été mis à jour.");
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between px-5 pt-2">
        <Text className="text-2xl font-display tracking-tight text-text">Changer le mot de passe</Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Fermer" accessibilityRole="button">
          <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} accessibilityElementsHidden />
        </TouchableOpacity>
      </View>

      <View className="gap-5 px-5 pt-6">
        <Field label="Nouveau mot de passe">
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
            placeholder="Retape ton nouveau mot de passe"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
          />
        </Field>
      </View>

      <View className="px-5 pb-2 pt-6">
        <PrimaryButton
          label={loading ? "Enregistrement..." : "Enregistrer"}
          disabled={!canSave || loading}
          onPress={submit}
        />
      </View>
    </SafeAreaView>
  );
}
