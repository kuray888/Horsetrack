import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { colors } from "@/theme/colors";
import { isOnboardingCompleted } from "@/onboarding/completion";

/**
 * Écran de démarrage : l'onboarding est la PREMIÈRE chose vue tant qu'il n'est
 * pas terminé. Ensuite, on entre dans l'app.
 *
 * TODO: réintroduire le check de session Supabase (auth bypass temporaire) :
 *       pas de session → (auth)/login ; sinon onboarding/app selon le flag.
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
