import { router } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EMPTY_HORSE_DRAFT, HorseForm } from "@/components/HorseForm";
import { useHorses } from "@/horses/store";
import { maxHorses, useSubscription } from "@/subscription/store";

function HorseLimitReached({ limit }: { limit: number }) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <Text className="text-3xl">🔒</Text>
        <Text className="text-center text-xl font-bold text-text">
          Limite de {limit} cheval{limit > 1 ? "x" : ""} atteinte
        </Text>
        <Text className="text-center text-sm text-muted">
          Passe à un palier supérieur ou ajoute un cheval supplémentaire à la carte pour agrandir ton écurie.
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/paywall")}
          className="rounded-full bg-primary px-6 py-3"
        >
          <Text className="text-sm font-bold text-on-primary">Voir les offres</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text className="text-sm font-semibold text-muted">Retour</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function AddHorseModal() {
  const { addHorse, horses } = useHorses();
  const subscription = useSubscription();
  const limit = maxHorses(subscription);

  if (horses.length >= limit) {
    return <HorseLimitReached limit={limit} />;
  }

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
