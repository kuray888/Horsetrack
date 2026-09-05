import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useHorses } from "@/horses/store";

/**
 * Module Journal — pas de reconstruction pour cette tranche (cf. plan Phase
 * 3 Étape 2) : redirige vers l'onglet Journal global, pré-filtré sur ce
 * cheval (cf. app/(tabs)/journal.tsx, qui lit ?horse=).
 */
export default function HorseJournalRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectHorse } = useHorses();

  useEffect(() => {
    if (id) selectHorse(id);
    router.replace(`/(tabs)/journal?horse=${id}`);
  }, [id, selectHorse]);

  return null;
}
