import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { supabase } from "@/lib/supabase";

function generateNonce(): string {
  const bytes = Crypto.getRandomBytes(32);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export type AppleSignInResult = { cancelled: true } | { cancelled: false; userId: string };

/**
 * Flux natif "Se connecter avec Apple" → échange de l'identityToken contre une
 * session Supabase (crée le compte à la volée si c'est la première connexion
 * de cette identité Apple — signup et login passent par le même appel).
 *
 * Le nonce fait un aller-retour recommandé par Apple/Supabase pour lier la
 * requête native à l'échange de jeton (anti-rejeu) : la version hashée
 * (SHA-256) part à Apple, la version brute part à Supabase qui la re-hash
 * lui-même pour vérifier la correspondance avec le hash signé par Apple.
 */
export async function signInWithApple(): Promise<AppleSignInResult> {
  const rawNonce = generateNonce();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string })?.code === "ERR_REQUEST_CANCELED") return { cancelled: true };
    throw e;
  }

  if (!credential.identityToken) {
    throw new Error("Apple n'a renvoyé aucun jeton d'identité.");
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;

  const userId = data.user?.id;
  if (!userId) throw new Error("Connexion Apple réussie mais aucun utilisateur renvoyé.");
  return { cancelled: false, userId };
}

/** N'affiche le bouton Apple que sur iOS et quand l'API est réellement
 * disponible (absente en simulateur sans compte Apple configuré, iOS trop
 * ancien, etc.). */
export function useAppleSignInAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    AppleAuthentication.isAvailableAsync().then(setAvailable);
  }, []);
  return available;
}
