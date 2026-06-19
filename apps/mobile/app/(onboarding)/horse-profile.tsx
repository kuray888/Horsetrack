import { View, Text } from "react-native";
import { router } from "expo-router";
import { OnboardingShell, SingleSelect, MultiSelectChips } from "@/components/onboarding";
import { useOnboarding } from "@/onboarding/store";
import { DISCIPLINES, HORSE_LEVELS, HORSE_TRAITS, TOTAL_STEPS } from "@/onboarding/options";

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function HorseProfile() {
  const { editingHorse, updateEditingHorse } = useOnboarding();
  const name = editingHorse.name.trim() || "ton cheval";

  return (
    <OnboardingShell
      step={6}
      total={TOTAL_STEPS}
      title={`Le profil sportif de ${name}`}
      subtitle="On cible le travail là où il compte vraiment."
      ctaDisabled={!editingHorse.discipline || !editingHorse.level}
      onNext={() => router.push("/(onboarding)/horses")}
    >
      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted">Discipline travaillée</Text>
        <SingleSelect
          options={DISCIPLINES}
          value={editingHorse.discipline}
          onChange={(discipline) => updateEditingHorse({ discipline })}
        />
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted">Niveau du cheval</Text>
        <SingleSelect
          options={HORSE_LEVELS}
          value={editingHorse.level}
          onChange={(level) => updateEditingHorse({ level })}
        />
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted">Ses points forts 💪</Text>
        <MultiSelectChips
          options={HORSE_TRAITS}
          values={editingHorse.strengths}
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
