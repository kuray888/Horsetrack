import { useEffect } from "react";
import { Linking } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { extractRecoveryTokens } from "@/lib/passwordRecovery";

/**
 * Intercepte le lien de récupération de mot de passe envoyé par Supabase
 * (cf. lib/passwordRecovery.ts) pour établir la session de récupération et
 * amener directement à /reset-password — sans ça, taper le lien depuis
 * l'email ouvre l'app sans jamais poser la session dont a besoin
 * `supabase.auth.updateUser` côté reset-password.tsx. Monté une seule fois à
 * la racine (cf. _layout.tsx), comme PasswordRecoveryListener/BadgeCelebration.
 */
export function PasswordRecoveryListener() {
  useEffect(() => {
    async function handle(url: string | null) {
      if (!url) return;
      const tokens = extractRecoveryTokens(url);
      if (!tokens) return;

      const { error } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
      if (!error) router.replace("/reset-password");
    }

    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener("url", (e) => handle(e.url));
    return () => sub.remove();
  }, []);

  return null;
}
