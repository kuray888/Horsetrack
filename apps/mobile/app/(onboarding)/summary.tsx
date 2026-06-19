import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { PrimaryButton } from "@/components/onboarding";
import { useOnboarding } from "@/onboarding/store";
import { RIDER_GOALS, DISCIPLINES } from "@/onboarding/options";

const GOAL_PITCH: Record<string, string> = {
  COMPETE: "grimper en niveau de concours",
  BONDING: "renforcer votre complicité",
  FITNESS: "le remettre en pleine forme",
  EVENT_PREP: "préparer ton prochain événement",
  CONFIDENCE: "reprendre confiance en selle",
};

function PlanRow({ text }: { text: string }) {
  return (
    <View className="flex-row items-start gap-3 py-2.5">
      <Text className="text-base text-success">✓</Text>
      <Text className="flex-1 text-base text-text">{text}</Text>
    </View>
  );
}

export default function Summary() {
  const { rider, horses } = useOnboarding();
  const primary = horses.find((h) => h.isPrimary) ?? horses[0];
  const horseName = primary?.name?.trim() || "ton cheval";
  const goalPitch = rider.primaryGoal ? GOAL_PITCH[rider.primaryGoal] : "progresser ensemble";
  const disciplineLabel =
    DISCIPLINES.find((d) => d.value === (primary?.discipline ?? rider.mainDiscipline))?.label ??
    "ta discipline";
  const focus = primary?.weaknesses?.[0];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScrollView contentContainerClassName="px-5 pt-8 pb-4 gap-5" showsVerticalScrollIndicator={false}>
        <View className="gap-2">
          <Text className="text-3xl font-extrabold leading-tight tracking-tight text-text">
            Le programme de {horseName} est prêt 🎉
          </Text>
          <Text className="text-base text-muted">
            Construit pour {goalPitch}, en {disciplineLabel.toLowerCase()}.
          </Text>
        </View>

        <View className="rounded-card bg-surface p-5 shadow-card">
          <Text className="mb-1 text-sm font-bold uppercase tracking-wide text-accent">
            Ton plan personnalisé
          </Text>
          <PlanRow text={`Séances adaptées au niveau de ${horseName}`} />
          {focus ? <PlanRow text={`Exercices ciblés : ${focus.toLowerCase()}`} /> : null}
          <PlanRow text="Suivi de progression & objectifs" />
          <PlanRow text="Coach IA disponible 24/7" />
          <PlanRow text={`Toute ton écurie (${horses.length} cheval${horses.length > 1 ? "x" : ""}) suivie`} />
        </View>

        {rider.additionalInfo.trim() ? (
          <View className="rounded-card bg-surface p-5 shadow-card">
            <Text className="mb-1 text-sm font-bold uppercase tracking-wide text-accent">
              On a bien pris note 📝
            </Text>
            <Text className="text-base text-text">{rider.additionalInfo.trim()}</Text>
          </View>
        ) : null}

        <View className="rounded-card border border-border bg-highlight/40 p-4">
          <Text className="text-center text-base font-semibold text-primary">
            Essaie tout gratuitement pendant 7 jours.
          </Text>
        </View>
      </ScrollView>

      <View className="px-5 pb-2 pt-3">
        <PrimaryButton
          label="Voir mon programme"
          onPress={() => router.push("/(onboarding)/paywall")}
        />
      </View>
    </SafeAreaView>
  );
}
