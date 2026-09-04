import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useHorses } from "@/horses/store";

/**
 * Module Santé — pas de reconstruction pour cette tranche (cf. plan Phase 3
 * Étape 2) : redirige vers l'onglet Agenda, section "Rendez-vous", qui
 * couvre déjà santé/soins pour ce cheval (formulaires, checklist concours,
 * rappels…) sans dupliquer cette logique. Sélectionne d'abord le cheval pour
 * rester cohérent avec la sélection globale (même garantie que le Horse Hub).
 */
export default function HorseSanteRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectHorse } = useHorses();

  useEffect(() => {
    if (id) selectHorse(id);
    router.replace("/(tabs)/agenda?section=appointments");
  }, [id, selectHorse]);

  return null;
}
