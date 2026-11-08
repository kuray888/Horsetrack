import * as SecureStore from "expo-secure-store";
import { removeJson } from "@/lib/localStore";
import { DRAFT_KEY } from "./draftPersistence";

/**
 * Flag local « onboarding terminé », pour décider de l'écran de démarrage
 * (cf. app/index.tsx). Source de vérité côté serveur plus tard
 * (rider_profiles.onboarding_completed_at), mais ce flag évite de re-router
 * l'utilisateur à chaque ouverture avant la persistance backend.
 */
const KEY = "onboarding_completed_v1";

export async function isOnboardingCompleted(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) === "true";
  } catch {
    return false;
  }
}

/** Fin de l'onboarding : le brouillon sauvegardé n'a plus lieu d'être
 * (cf. onboarding/draftPersistence.ts). */
export async function markOnboardingCompleted(): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, "true");
    await removeJson(DRAFT_KEY);
  } catch {
    // Best-effort : cf. audit crash SecureStore du 2026-09-08.
  }
}

/** Outil de dev/test : efface le flag pour repasser par l'onboarding complet. */
/** Retour à une installation neuve (suppression du compte, compte jamais
 * terminé) : un vieux brouillon ne doit pas pré-remplir le suivant. */
export async function resetOnboardingCompleted(options: { keepDraft?: boolean } = {}): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
    if (!options.keepDraft) await removeJson(DRAFT_KEY);
  } catch {
    // Best-effort : cf. audit crash SecureStore du 2026-09-08.
  }
}
