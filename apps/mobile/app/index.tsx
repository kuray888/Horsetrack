import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { colors } from "@/theme/colors";
import { supabase } from "@/lib/supabase";
import { isOnboardingCompleted } from "@/onboarding/completion";

/**
 * Écran de démarrage : pas de session Supabase → (auth)/login. Sinon,
 * l'onboarding est la première chose vue tant qu'il n'est pas terminé,
 * ensuite on entre dans l'app.
 */
export default function Index() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [done, setDone] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    isOnboardingCompleted().then(setDone);
  }, []);

  if (hasSession === null || done === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!hasSession) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href={done ? "/(tabs)/today" : "/(onboarding)/welcome"} />;
}
