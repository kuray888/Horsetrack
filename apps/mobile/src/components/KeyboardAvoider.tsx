import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";

/**
 * Remonte le contenu et le bouton fixe du bas au-dessus du clavier iOS.
 * À placer juste sous le SafeAreaView d'un écran à saisie qui n'utilise pas
 * `Screen` (modales de formulaire, connexion) : sans lui, le clavier masque
 * les derniers champs et le bouton « Enregistrer ».
 */
export function KeyboardAvoider({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {children}
    </KeyboardAvoidingView>
  );
}
