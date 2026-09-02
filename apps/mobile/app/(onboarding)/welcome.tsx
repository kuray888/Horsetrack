import { Image, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { PrimaryButton } from "@/components/onboarding";
import { FadeInView } from "@/components/FadeInView";

export default function Welcome() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 justify-center px-6">
        <FadeInView>
          <Image
            source={require("../../assets/icon.png")}
            style={{ width: 96, height: 96 }}
            resizeMode="contain"
          />
        </FadeInView>
        <FadeInView delay={100}>
          <Text className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-text">
            Toi et ton cheval, organisés.
          </Text>
        </FadeInView>
        <FadeInView delay={200}>
          <Text className="mt-4 text-lg text-muted">
            Planning, rendez-vous santé, concours et suivi financier au même endroit, pour progresser
            ensemble — quelle que soit ta discipline.
          </Text>
        </FadeInView>
      </View>

      <FadeInView delay={300}>
        <View className="gap-3 px-6 pb-2">
          <PrimaryButton label="Commencer" onPress={() => router.push("/(onboarding)/rider-level")} />
          <Text className="text-center text-xs text-muted">
            Essai gratuit de 2 mois · sans engagement
          </Text>
        </View>
      </FadeInView>
    </SafeAreaView>
  );
}
