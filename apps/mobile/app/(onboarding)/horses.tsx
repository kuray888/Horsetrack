import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { OnboardingShell } from "@/components/onboarding";
import { useOnboarding } from "@/onboarding/store";
import { DISCIPLINES, TOTAL_STEPS } from "@/onboarding/options";
import { colors } from "@/theme/colors";

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
      step={9}
      total={TOTAL_STEPS}
      title="Ton écurie"
      subtitle="Ajoute autant de chevaux que tu veux — c'est inclus, sans supplément."
      ctaLabel="C'est tout, continuer"
      onNext={() => router.push("/(onboarding)/summary")}
    >
      <View className="gap-3">
        {namedHorses.map((h, i) => (
          <View
            key={h.localId}
            className="flex-row items-center gap-3 rounded-card border border-border bg-surface p-4"
          >
            <View className="h-12 w-12 items-center justify-center rounded-full bg-highlight">
              <MaterialCommunityIcons name="horse-variant" size={22} color={colors.primary} />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-base font-bold text-text">{h.name}</Text>
                {h.isPrimary ? <MaterialCommunityIcons name="star" size={13} color={colors.warning} /> : null}
              </View>
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
              <TouchableOpacity
                onPress={() => removeHorse(h.localId)}
                hitSlop={8}
                accessibilityLabel={`Retirer ${h.name}`}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="close" size={16} color={colors.danger} accessibilityElementsHidden />
              </TouchableOpacity>
            ) : null}
          </View>
        ))}

        <TouchableOpacity
          onPress={addAnother}
          activeOpacity={0.8}
          className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-primary p-4"
        >
          <MaterialCommunityIcons name="plus" size={18} color={colors.primary} />
          <Text className="text-base font-semibold text-primary">Ajouter un autre cheval</Text>
        </TouchableOpacity>
      </View>
    </OnboardingShell>
  );
}
