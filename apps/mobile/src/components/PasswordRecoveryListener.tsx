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

      await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
      // Navigue vers /reset-password que setSession ait réussi ou non (lien
      // expiré/déjà utilisé) : cet écran vérifie lui-même la session
      // (`ready`) et affiche déjà un message clair "Ce lien n'est plus
      // valide" quand elle est absente — avant, un setSession en échec ne
      // naviguait nulle part, laissant le lien ouvrir l'app sans aucune
      // explication (cf. audit pré-publication).
      router.replace("/reset-password");
    }

    Linking.getInitialURL()
      .then(handle)
      .catch((e) => console.warn("[password-recovery] traitement du lien initial échoué", e));
    const sub = Linking.addEventListener("url", (e) =>
      handle(e.url).catch((err) => console.warn("[password-recovery] traitement du lien échoué", err))
    );
    return () => sub.remove();
  }, []);

  return null;
}
