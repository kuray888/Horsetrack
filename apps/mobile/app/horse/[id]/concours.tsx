import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useHorses } from "@/horses/store";

/**
 * Module Concours — redirige vers le Planning unifié (cf. plan Phase 3
 * Étape 3), filtré sur "Concours" : les concours (Appointment de type
 * "concours", checklist/épreuves/résultats inclus, cf. AppointmentCard via
 * UnifiedEventCard) y sont maintenant visibles avec leur contexte temporel,
 * plutôt que dans la liste plate de rendez-vous de l'ancien Agenda.
 */
export default function HorseConcoursRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectHorse } = useHorses();

  useEffect(() => {
    if (id) selectHorse(id);
    router.replace("/(tabs)/planning?filter=concours");
  }, [id, selectHorse]);

  return null;
}
