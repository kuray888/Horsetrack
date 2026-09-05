import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useHorses } from "@/horses/store";

/**
 * Module Documents — pas de reconstruction pour cette tranche (cf. plan
 * Phase 3 Étape 2) : redirige vers l'onglet Agenda, section "Documents"
 * (coffre-fort), qui couvre déjà ce cheval.
 */
export default function HorseDocumentsRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectHorse } = useHorses();

  useEffect(() => {
    if (id) selectHorse(id);
    router.replace("/(tabs)/agenda?section=documents");
  }, [id, selectHorse]);

  return null;
}
