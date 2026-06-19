import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { PrimaryButton } from "@/components/onboarding";

export default function Welcome() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 justify-center px-6">
        <Text className="text-5xl">🐴</Text>
        <Text className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-text">
          Le coach de toi et ton cheval.
        </Text>
        <Text className="mt-4 text-lg text-muted">
          Un programme sur-mesure pour progresser ensemble, suivre ta monte et garder ton cheval
          au top — quelle que soit ta discipline.
        </Text>
      </View>

      <View className="gap-3 px-6 pb-2">
        <PrimaryButton label="Commencer" onPress={() => router.push("/(onboarding)/rider-level")} />
        <Text className="text-center text-xs text-muted">
          Essai gratuit de 7 jours · sans engagement
        </Text>
      </View>
    </SafeAreaView>
  );
}
