import { View, Text } from "react-native";
import { router } from "expo-router";
import { OnboardingShell, MultiSelectChips } from "@/components/onboarding";
import { useOnboarding } from "@/onboarding/store";
import { HORSE_TEMPERAMENTS, HORSE_TRAITS, TOTAL_STEPS } from "@/onboarding/options";

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function HorseTemperament() {
  const { editingHorse, updateEditingHorse } = useOnboarding();
  const name = editingHorse.name.trim() || "ton cheval";

  return (
    <OnboardingShell
      step={7}
      total={TOTAL_STEPS}
      title={`Le caractère de ${name}`}
      subtitle="Pour adapter le ton et le rythme du programme à sa personnalité."
      onNext={() => router.push("/(onboarding)/horse-health")}
    >
      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted">Tempérament</Text>
        <MultiSelectChips
          options={HORSE_TEMPERAMENTS}
          values={editingHorse.temperament}
          allowCustom
          onToggle={(t) => updateEditingHorse({ temperament: toggle(editingHorse.temperament, t) })}
        />
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted">Ses points forts 💪</Text>
        <MultiSelectChips
          options={HORSE_TRAITS}
          values={editingHorse.strengths}
          allowCustom
          onToggle={(t) =>
            updateEditingHorse({
              strengths: toggle(editingHorse.strengths, t),
              // un tag ne peut pas être à la fois force et faiblesse
              weaknesses: editingHorse.weaknesses.filter((w) => w !== t),
            })
          }
        />
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted">Ses points à travailler 🎯</Text>
        <MultiSelectChips
          options={HORSE_TRAITS}
          values={editingHorse.weaknesses}
          allowCustom
          onToggle={(t) =>
            updateEditingHorse({
              weaknesses: toggle(editingHorse.weaknesses, t),
              strengths: editingHorse.strengths.filter((s) => s !== t),
            })
          }
        />
      </View>
    </OnboardingShell>
  );
}
