import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { colors } from "@/theme/colors";
import { isOnboardingCompleted } from "@/onboarding/completion";

/**
 * Écran de démarrage : l'onboarding est la première chose vue tant qu'il
 * n'est pas terminé, ensuite on entre dans l'app.
 *
 * Le check de session Supabase est volontairement désactivé pour l'instant
 * (cf. (onboarding)/account.tsx et (auth)/login.tsx, gardés mais débranchés
 * du flow principal) — à réactiver quand le système de compte sera retravaillé.
 */
export default function Index() {
  const [done, setDone] = useState<boolean | null>(null);

  useEffect(() => {
    isOnboardingCompleted().then(setDone);
  }, []);

  if (done === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={done ? "/(tabs)/today" : "/(onboarding)/welcome"} />;
}
