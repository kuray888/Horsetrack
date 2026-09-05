import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useHorses } from "@/horses/store";

/**
 * Module Budget — pas de reconstruction pour cette tranche (cf. plan Phase 3
 * Étape 2) : redirige vers l'onglet Agenda, section "Finances", qui couvre
 * déjà dépenses/totaux/répartition pour ce cheval.
 */
export default function HorseBudgetRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectHorse } = useHorses();

  useEffect(() => {
    if (id) selectHorse(id);
    router.replace("/(tabs)/agenda?section=finances");
  }, [id, selectHorse]);

  return null;
}
