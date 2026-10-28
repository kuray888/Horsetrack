import { useEffect } from "react";
import { View } from "react-native";
import { router } from "expo-router";

/**
 * Adresse de retour de la connexion avec Google (horsetrack://auth-callback,
 * cf. lib/googleAuth.ts). Sur Android, le système rouvre aussi l'app sur
 * cette adresse : sans écran à ce nom, expo-router affichait « écran
 * introuvable » par-dessus la connexion. Celui-ci s'efface aussitôt ; c'est
 * l'écran de connexion, resté dessous, qui termine la connexion.
 */
export default function AuthCallbackScreen() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, []);
  return <View className="flex-1 bg-background" />;
}
