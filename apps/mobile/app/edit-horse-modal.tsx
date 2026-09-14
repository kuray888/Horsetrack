import { Alert, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { HorseForm } from "@/components/HorseForm";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { useHorses } from "@/horses/store";
import { useAgenda } from "@/agenda/store";
import { useSessions } from "@/sessions/store";
import { useWeight } from "@/horses/weightStore";

export default function EditHorseModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { horses, updateHorse, removeHorse } = useHorses();
  const { removeHorseData: removeAgendaHorseData } = useAgenda();
  const { removeHorseData: removeSessionsHorseData } = useSessions();
  const { removeHorseData: removeWeightHorseData } = useWeight();
  const horse = horses.find((h) => h.id === id);
  const ownedHorseCount = horses.filter((h) => !h.sharedRole).length;

  if (!horse || horse.sharedRole) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="text-base text-muted">
          {horse?.sharedRole ? "Les chevaux partagés ne sont pas modifiables." : "Cheval introuvable."}
        </Text>
      </SafeAreaView>
    );
  }

  function confirmDelete() {
    if (ownedHorseCount <= 1) {
      Alert.alert("Impossible", "Tu dois garder au moins un cheval dans ton écurie.");
      return;
    }
    Alert.alert(
      "Supprimer ce cheval ?",
      `${horse!.name} et tout son historique (séances, rendez-vous, journal) seront définitivement supprimés. Cette action est irréversible.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            // removeHorse() ne touche qu'à l'écurie locale — sans ces 3
            // appels, le journal/planning/dépenses/séances/poids du cheval
            // supprimé restaient visibles indéfiniment dans les vues non
            // filtrées par cheval (ex: Journal "tous les chevaux"), sous un
            // nom de cheval devenu "?" (cf. audit du 2026-09-14). Le serveur,
            // lui, a déjà tout supprimé via le cascade Postgres déclenché par
            // la suppression du cheval — ceci ne fait que refléter ça en local.
            removeAgendaHorseData(horse!.id);
            removeSessionsHorseData(horse!.id);
            removeWeightHorseData(horse!.id);
            removeHorse(horse!.id);
            router.back();
          },
        },
      ]
    );
  }

  return (
    <>
    <HorseForm
      title="Modifier le cheval"
      submitLabel="Enregistrer"
      initial={horse}
      onSubmit={(updated) => {
        updateHorse(horse.id, updated);
        router.back();
      }}
      onDelete={confirmDelete}
    />
    <PickerOverlaySlot />
    </>
  );
}
