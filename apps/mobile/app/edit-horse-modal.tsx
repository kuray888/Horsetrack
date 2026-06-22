import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { HorseForm } from "@/components/HorseForm";
import { useHorses } from "@/horses/store";

export default function EditHorseModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { horses, updateHorse } = useHorses();
  const horse = horses.find((h) => h.id === id);

  if (!horse) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="text-base text-muted">Cheval introuvable.</Text>
      </SafeAreaView>
    );
  }

  return (
    <HorseForm
      title="Modifier le cheval"
      submitLabel="Enregistrer"
      initial={horse}
      onSubmit={(updated) => {
        updateHorse(horse.id, updated);
        router.back();
      }}
    />
  );
}
