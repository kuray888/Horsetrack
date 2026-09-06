import { Alert, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { HorseForm } from "@/components/HorseForm";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { useHorses } from "@/horses/store";

export default function EditHorseModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { horses, updateHorse, removeHorse } = useHorses();
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
