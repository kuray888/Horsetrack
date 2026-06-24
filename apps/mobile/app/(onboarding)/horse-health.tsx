import { View, Text } from "react-native";
import { router } from "expo-router";
import { OnboardingShell, MultiSelectChips } from "@/components/onboarding";
import { InjuryHistoryField } from "@/components/InjuryHistoryField";
import { useOnboarding } from "@/onboarding/store";
import { HEALTH_CONDITIONS, NO_HEALTH_CONDITION, REST_DAY_ACTIVITIES, TOTAL_STEPS } from "@/onboarding/options";

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function toggleHealthCondition(list: string[], value: string): string[] {
  if (value === NO_HEALTH_CONDITION) {
    return list.includes(NO_HEALTH_CONDITION) ? [] : [NO_HEALTH_CONDITION];
  }
  const withoutNone = list.filter((v) => v !== NO_HEALTH_CONDITION);
  return withoutNone.includes(value) ? withoutNone.filter((v) => v !== value) : [...withoutNone, value];
}

export default function HorseHealth() {
  const { editingHorse, updateEditingHorse, addInjury, removeInjury } = useOnboarding();
  const name = editingHorse.name.trim() || "ton cheval";

  return (
    <OnboardingShell
      step={8}
      total={TOTAL_STEPS}
      title={`Santé & antécédents de ${name}`}
      subtitle="Pour que le programme respecte ses limites physiques."
      onNext={() => router.push("/(onboarding)/horses")}
    >
      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted">Conditions de santé actuelles</Text>
        <MultiSelectChips
          options={HEALTH_CONDITIONS}
          values={editingHorse.healthConditions}
          onToggle={(t) =>
            updateEditingHorse({ healthConditions: toggleHealthCondition(editingHorse.healthConditions, t) })
          }
        />
      </View>

      <InjuryHistoryField
        injuries={editingHorse.injuries.map((i) => ({ ...i, key: i.localId }))}
        onAdd={addInjury}
        onRemove={removeInjury}
      />

      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted">Les jours sans séance, {name} est plutôt…</Text>
        <Text className="text-xs text-muted">
          Plusieurs choix possibles : ils tournent d&apos;un jour de repos à l&apos;autre (ex. paddock un jour, box le suivant).
        </Text>
        <MultiSelectChips
          options={REST_DAY_ACTIVITIES}
          values={editingHorse.restDayActivities}
          allowCustom
          onToggle={(t) =>
            updateEditingHorse({ restDayActivities: toggle(editingHorse.restDayActivities, t) })
          }
        />
      </View>
    </OnboardingShell>
  );
}
