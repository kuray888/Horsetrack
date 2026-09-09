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
/**
 * Best-effort comme le reste des lectures SecureStore de l'app (cf.
 * lib/biometrics.ts) — c'est le tout premier appel juste après la
 * confirmation Face ID dans (auth)/login.tsx.afterSuccessfulAuth, jamais
 * couvert par les audits précédents (f18799e, b079f20) contrairement à
 * quasiment tous les autres call sites SecureStore directs de l'app. Un rejet
 * ici (Keychain) traité comme "propriétaire différent" déclenche juste une
 * restauration cloud au lieu de planter — comportement déjà correct pour un
 * appareil qui n'a réellement jamais vu ce compte.
 */
export async function getLocalDataOwner(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function setLocalDataOwner(userId: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, userId);
  } catch {
    // Best-effort : cf. audit crash SecureStore du 2026-09-08.
  }
}

export async function clearLocalDataOwner(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Best-effort : cf. audit crash SecureStore du 2026-09-08.
  }
}
