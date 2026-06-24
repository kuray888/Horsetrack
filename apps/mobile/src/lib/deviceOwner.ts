import * as SecureStore from "expo-secure-store";

const KEY = "local_data_owner_v1";

/**
 * Id Supabase du compte à qui appartiennent les données mises en cache sur cet
 * appareil (écurie, profil cavalier, progression, agenda, abonnement — cf.
 * src/horses/store.tsx et les stores voisins). Aucune de ces données n'est
 * namespacée par utilisateur : sans ce garde-fou, un compte qui se connecte
 * sur un appareil déjà utilisé par un autre compte hériterait silencieusement
 * de son cache local (cf. (auth)/login.tsx, (onboarding)/account.tsx).
 */
export async function getLocalDataOwner(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export async function setLocalDataOwner(userId: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, userId);
}

export async function clearLocalDataOwner(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
