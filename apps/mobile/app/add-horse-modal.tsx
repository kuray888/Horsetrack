import { router } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { EMPTY_HORSE_DRAFT, HorseForm } from "@/components/HorseForm";
import { useHorses } from "@/horses/store";
import { maxHorses, useSubscription } from "@/subscription/store";
import { colors } from "@/theme/colors";

function HorseLimitReached({ limit }: { limit: number }) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-highlight">
          <MaterialCommunityIcons name="lock-outline" size={28} color={colors.primary} />
        </View>
        <Text className="text-center text-xl font-bold text-text">
          Limite de {limit} {limit > 1 ? "chevaux" : "cheval"} atteinte
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
  // Les chevaux partagés (DP/coach) ne comptent jamais dans le quota du
  // palier — même règle que profile.tsx/today.tsx (cf. Horse.sharedRole).
  const ownedCount = horses.filter((h) => !h.sharedRole).length;

  if (ownedCount >= limit) {
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
