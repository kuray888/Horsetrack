import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { colors } from "@/theme/colors";
import { isOnboardingCompleted } from "@/onboarding/completion";

/**
 * Écran de démarrage : l'onboarding est la première chose vue tant qu'il
 * n'est pas terminé, ensuite on entre dans l'app.
 *
 * Le check de session Supabase est temporairement retiré ici pour explorer
 * l'app librement sans repasser par login à chaque rechargement — (auth)/login.tsx
 * et la création de compte dans l'onboarding restent fonctionnels, juste plus
 * imposés au démarrage. À réactiver avant publication (cf. historique du repo,
 * ce check a déjà été écrit et retiré plusieurs fois : juste remettre
 * `supabase.auth.getSession()` + redirect vers /(auth)/login si pas de session).
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
