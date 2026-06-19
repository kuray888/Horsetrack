import * as SecureStore from "expo-secure-store";

/**
 * Flag local « onboarding terminé », pour décider de l'écran de démarrage
 * (cf. app/index.tsx). Source de vérité côté serveur plus tard
 * (rider_profiles.onboarding_completed_at), mais ce flag évite de re-router
 * l'utilisateur à chaque ouverture avant la persistance backend.
 */
const KEY = "onboarding_completed_v1";

export async function isOnboardingCompleted(): Promise<boolean> {
  return (await SecureStore.getItemAsync(KEY)) === "true";
}

export async function markOnboardingCompleted(): Promise<void> {
  await SecureStore.setItemAsync(KEY, "true");
}

/** Outil de dev/test : efface le flag pour repasser par l'onboarding complet. */
export async function resetOnboardingCompleted(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
