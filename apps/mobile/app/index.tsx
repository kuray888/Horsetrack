import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { colors } from "@/theme/colors";
import { supabase } from "@/lib/supabase";
import { isOnboardingCompleted } from "@/onboarding/completion";

/**
 * Écran de démarrage : l'onboarding est la première chose vue tant qu'il
 * n'est pas terminé (le compte se crée lui-même au milieu de ce parcours,
 * cf. (onboarding)/account.tsx — pas besoin de session avant). Une fois
 * l'onboarding fait, on a forcément un compte : s'il n'y a plus de session
 * (déconnexion), on renvoie vers le login plutôt que de relancer l'onboarding.
 */
export default function Index() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [done, setDone] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setHasSession(!!data.session))
      .catch((e) => {
        console.warn("[index] getSession échoué, on suppose aucune session", e);
        setHasSession(false);
      });
    isOnboardingCompleted()
      .then(setDone)
      .catch((e) => {
        console.warn("[index] isOnboardingCompleted échoué, on repart sur l'onboarding", e);
        setDone(false);
      });
  }, []);

  if (hasSession === null || done === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!done) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  return <Redirect href={hasSession ? "/(tabs)/today" : "/(auth)/login"} />;
}
