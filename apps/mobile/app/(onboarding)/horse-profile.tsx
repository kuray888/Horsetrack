import { View, Text } from "react-native";
import { router } from "expo-router";
import { OnboardingShell, SingleSelect } from "@/components/onboarding";
import { DropdownField } from "@/components/DropdownField";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { useOnboarding } from "@/onboarding/store";
import { DISCIPLINES, HORSE_FITNESS_LEVELS, HORSE_LEVELS, HORSE_WORKLOADS, TOTAL_STEPS } from "@/onboarding/options";

export default function HorseProfile() {
  const { editingHorse, updateEditingHorse } = useOnboarding();
  const name = editingHorse.name.trim() || "ton cheval";

  return (
    <>
    <OnboardingShell
      step={6}
      total={TOTAL_STEPS}
      title={`Le profil sportif de ${name}`}
      subtitle="On cible le travail là où il compte vraiment."
      ctaDisabled={!editingHorse.discipline || !editingHorse.level}
      onNext={() => router.push("/(onboarding)/horse-temperament")}
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

      <DropdownField
        label="Niveau de forme actuel"
        options={HORSE_FITNESS_LEVELS}
        value={editingHorse.fitnessLevel}
        onChange={(fitnessLevel) => updateEditingHorse({ fitnessLevel })}
        placeholder="Sélectionner la forme actuelle"
      />

      <DropdownField
        label="Charge de travail actuelle"
        options={HORSE_WORKLOADS}
        value={editingHorse.workload}
        onChange={(workload) => updateEditingHorse({ workload })}
        placeholder="Sélectionner la charge de travail"
      />
    </OnboardingShell>
    <PickerOverlaySlot />
    </>
  );
}
