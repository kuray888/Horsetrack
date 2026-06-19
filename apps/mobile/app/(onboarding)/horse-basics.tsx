import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { OnboardingShell, SingleSelect } from "@/components/onboarding";
import { Field } from "@/components/Field";
import { useOnboarding } from "@/onboarding/store";
import { HORSE_SEXES, TOTAL_STEPS } from "@/onboarding/options";

const INPUT =
  "rounded-card border border-border bg-surface p-4 text-base text-text";

export default function HorseBasics() {
  const { editingHorse, updateEditingHorse } = useOnboarding();
  const currentYear = new Date().getFullYear();

  return (
    <OnboardingShell
      step={5}
      total={TOTAL_STEPS}
      title="Présente-nous ton cheval"
      subtitle="On personnalise tout autour de lui."
      ctaDisabled={editingHorse.name.trim().length === 0}
      onNext={() => router.push("/(onboarding)/horse-profile")}
    >
      {/* Photo (placeholder — TODO: brancher expo-image-picker) */}
      <View className="items-center">
        <TouchableOpacity
          activeOpacity={0.8}
          className="h-24 w-24 items-center justify-center rounded-full border border-dashed border-border bg-surface"
        >
          <Text className="text-3xl">🐴</Text>
        </TouchableOpacity>
        <Text className="mt-2 text-xs text-muted">Ajouter une photo (bientôt)</Text>
      </View>

      <Field label="Nom du cheval">
        <TextInput
          className={INPUT}
          placeholder="Ex : Quabar des Monts"
          value={editingHorse.name}
          onChangeText={(name) => updateEditingHorse({ name })}
          autoCapitalize="words"
        />
      </Field>

      <Field label="Année de naissance">
        <TextInput
          className={INPUT}
          placeholder={`Ex : ${currentYear - 8}`}
          keyboardType="number-pad"
          maxLength={4}
          value={editingHorse.birthYear ? String(editingHorse.birthYear) : ""}
          onChangeText={(t) => {
            const n = parseInt(t, 10);
            updateEditingHorse({ birthYear: Number.isNaN(n) ? null : n });
          }}
        />
      </Field>

      <Field label="Sexe">
        <SingleSelect
          options={HORSE_SEXES}
          value={editingHorse.sex}
          onChange={(sex) => updateEditingHorse({ sex })}
        />
      </Field>

      <Field label="Race (optionnel)">
        <TextInput
          className={INPUT}
          placeholder="Ex : Selle Français"
          value={editingHorse.breed ?? ""}
          onChangeText={(breed) => updateEditingHorse({ breed: breed || null })}
          autoCapitalize="words"
        />
      </Field>
    </OnboardingShell>
  );
}
