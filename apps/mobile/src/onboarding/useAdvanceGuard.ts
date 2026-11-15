import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { createAdvanceGuard } from "@/onboarding/advanceGuard";

/** Garde-fou d'un écran : une seule avance vers l'écran suivant, rouvert quand
 * l'écran retrouve le focus (retour arrière). Cf. advanceGuard.ts. */
export function useAdvanceGuard() {
  const [guard] = useState(createAdvanceGuard);
  useFocusEffect(
    useCallback(() => {
      guard.reset();
    }, [guard]),
  );
  return guard;
}
