import { router } from "expo-router";
import { EMPTY_HORSE_DRAFT, HorseForm } from "@/components/HorseForm";
import { useHorses } from "@/horses/store";

export default function AddHorseModal() {
  const { addHorse } = useHorses();

  return (
    <HorseForm
      title="Ajouter un cheval"
      submitLabel="Ajouter"
      initial={EMPTY_HORSE_DRAFT}
      onSubmit={(horse) => {
        addHorse(horse);
        router.back();
      }}
    />
  );
}
