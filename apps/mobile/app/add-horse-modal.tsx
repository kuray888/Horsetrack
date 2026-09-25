import { router } from "expo-router";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { EMPTY_HORSE_DRAFT, HorseForm } from "@/components/HorseForm";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { useHorses } from "@/horses/store";
import { maxHorses, useSubscription } from "@/subscription/store";
import { openPaywall } from "@/subscription/paywall";
import { markPremiumActivated } from "@/subscription/trialLifecycle";
import { track } from "@/lib/analytics";
import { colors } from "@/theme/colors";

function HorseLimitReached({ limit }: { limit: number }) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-highlight">
          <MaterialCommunityIcons name="lock-outline" size={28} color={colors.primary} />
        </View>
        <Text className="text-center text-xl font-bold text-text">Toute ton écurie, au même endroit</Text>
        <Text className="text-center text-sm text-muted">
          La version gratuite suit {limit} {limit > 1 ? "chevaux" : "cheval"}. Avec Premium, ajoute autant de chevaux que tu
          veux, chacun avec son planning, sa santé et son budget.
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => openPaywall("horses", { feature: "add_horse_limit" })}
          className="rounded-full bg-primary px-6 py-3"
        >
          <Text className="text-sm font-bold text-on-primary">Découvrir Premium</Text>
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
    // Tant que l'abonnement n'est pas chargé, l'état vaut « gratuit » par
    // défaut (limite 1) : un abonné Premium voyait donc « Limite atteinte »
    // clignoter une seconde avant que le formulaire ne prenne la place.
    if (subscription.loading) {
      return (
        <SafeAreaView className="flex-1 items-center justify-center bg-background" edges={["top", "bottom"]}>
          <ActivityIndicator color={colors.primary} />
        </SafeAreaView>
      );
    }
    return <HorseLimitReached limit={limit} />;
  }

  return (
    <>
    <HorseForm
      title="Ajouter un cheval"
      submitLabel="Ajouter"
      initial={EMPTY_HORSE_DRAFT}
      onSubmit={(horse) => {
        addHorse(horse);
        track("horse_added", { owned_count: ownedCount + 1 });
        // Un 2ᵉ cheval n'est possible qu'en Premium : c'est une activation.
        if (ownedCount >= 1) markPremiumActivated();
        router.back();
      }}
    />
    <PickerOverlaySlot />
    </>
  );
}
