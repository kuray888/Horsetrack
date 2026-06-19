import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { OnboardingShell } from "@/components/onboarding";
import { useOnboarding } from "@/onboarding/store";
import { DISCIPLINES, TOTAL_STEPS } from "@/onboarding/options";

function disciplineLabel(value: string | null): string {
  return DISCIPLINES.find((d) => d.value === value)?.label ?? "—";
}

export default function Horses() {
  const { horses, startNewHorse, editHorse, removeHorse } = useOnboarding();
  const namedHorses = horses.filter((h) => h.name.trim().length > 0);

  function addAnother() {
    startNewHorse();
    router.push("/(onboarding)/horse-basics");
  }

  return (
    <OnboardingShell
      step={7}
      total={TOTAL_STEPS}
      title="Ton écurie"
      subtitle="Ajoute autant de chevaux que tu veux — c'est inclus, sans supplément."
      ctaLabel="C'est tout, continuer"
      onNext={() => router.push("/(onboarding)/building")}
    >
      <View className="gap-3">
        {namedHorses.map((h, i) => (
          <View
            key={h.localId}
            className="flex-row items-center gap-3 rounded-card border border-border bg-surface p-4"
          >
            <View className="h-12 w-12 items-center justify-center rounded-full bg-highlight">
              <Text className="text-2xl">🐴</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-text">
                {h.name}
                {h.isPrimary ? "  ⭐" : ""}
              </Text>
              <Text className="text-sm text-muted">{disciplineLabel(h.discipline)}</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                editHorse(horses.indexOf(h));
                router.push("/(onboarding)/horse-basics");
              }}
              hitSlop={8}
            >
              <Text className="px-2 text-sm font-semibold text-accent">Modifier</Text>
            </TouchableOpacity>
            {namedHorses.length > 1 ? (
              <TouchableOpacity onPress={() => removeHorse(h.localId)} hitSlop={8}>
                <Text className="px-1 text-base text-danger">✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}

        <TouchableOpacity
          onPress={addAnother}
          activeOpacity={0.8}
          className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-primary p-4"
        >
          <Text className="text-lg font-bold text-primary">＋</Text>
          <Text className="text-base font-semibold text-primary">Ajouter un autre cheval</Text>
        </TouchableOpacity>
      </View>
    </OnboardingShell>
  );
}
