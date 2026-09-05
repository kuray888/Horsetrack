import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useHorses } from "@/horses/store";

/**
 * Module Entraînement — redirige vers le Planning unifié (cf. plan Phase 3
 * Étape 3), déjà filtré sur le cheval sélectionné, avec le filtre "Séances"
 * pré-sélectionné pour rester focalisé sur l'entraînement.
 */
export default function HorseEntrainementRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectHorse } = useHorses();

  useEffect(() => {
    if (id) selectHorse(id);
    router.replace("/(tabs)/planning?filter=session");
  }, [id, selectHorse]);

  return null;
}
