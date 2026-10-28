import { View, Text, TextInput, TouchableOpacity, Image } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { OnboardingShell, SingleSelect } from "@/components/onboarding";
import { BreedField } from "@/components/BreedField";
import { CoatField } from "@/components/CoatField";
import { Field } from "@/components/Field";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { useOnboarding } from "@/onboarding/store";
import { HORSE_SEXES, TOTAL_STEPS } from "@/onboarding/options";
import { chooseAndPersistImage } from "@/lib/imagePicker";
import { colors } from "@/theme/colors";
import { t as tr } from "@/i18n";

const INPUT =
  "rounded-card border border-border bg-surface p-4 text-base text-text";

export default function HorseBasics() {
  const { editingHorse, updateEditingHorse } = useOnboarding();
  const currentYear = new Date().getFullYear();

  async function pickPhoto() {
    const uri = await chooseAndPersistImage();
    if (uri) updateEditingHorse({ photoUrl: uri });
  }

  return (
    <>
    <OnboardingShell
      step={3}
      total={TOTAL_STEPS}
      title={tr("Présente-nous ton cheval")}
      subtitle={tr("Le nom suffit pour commencer — tu pourras compléter sa fiche plus tard.")}
      ctaDisabled={editingHorse.name.trim().length === 0}
      onNext={() => router.push("/(onboarding)/horses")}
    >
      {/* Photo */}
      <View className="items-center">
        <TouchableOpacity
          onPress={pickPhoto}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={tr("Choisir une photo du cheval")}
          className="h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-dashed border-border bg-surface"
        >
          {editingHorse.photoUrl ? (
            <Image source={{ uri: editingHorse.photoUrl }} className="h-24 w-24" />
          ) : (
            <MaterialCommunityIcons name="horse-variant" size={32} color={colors.textMuted} />
          )}
        </TouchableOpacity>
        <Text className="mt-2 text-xs text-muted">
          {editingHorse.photoUrl ? tr("Changer la photo") : tr("Ajouter une photo")}
        </Text>
      </View>

      <Field label={tr("Nom du cheval")}>
        <TextInput
          className={INPUT}
          placeholder={tr("Ex : Quabar des Monts")}
          value={editingHorse.name}
          onChangeText={(name) => updateEditingHorse({ name })}
          autoCapitalize="words"
        />
      </Field>

      <Field label={tr("Année de naissance")}>
        <TextInput
          className={INPUT}
          placeholder={tr("Ex : {v}", { v: currentYear - 8 })}
          keyboardType="number-pad"
          maxLength={4}
          value={editingHorse.birthYear ? String(editingHorse.birthYear) : ""}
          onChangeText={(t) => {
            const n = parseInt(t, 10);
            updateEditingHorse({ birthYear: Number.isNaN(n) ? null : Math.min(n, currentYear) });
          }}
        />
      </Field>

      <Field label={tr("Sexe")}>
        <SingleSelect
          options={HORSE_SEXES}
          value={editingHorse.sex}
          onChange={(sex) => updateEditingHorse({ sex })}
        />
      </Field>

      <BreedField value={editingHorse.breed} onChange={(breed) => updateEditingHorse({ breed })} />
      <CoatField value={editingHorse.coat} onChange={(coat) => updateEditingHorse({ coat })} />

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field label={tr("Taille au garrot (cm)")}>
            <TextInput
              className={INPUT}
              placeholder={tr("Ex : 165")}
              keyboardType="number-pad"
              maxLength={3}
              value={editingHorse.heightCm ? String(editingHorse.heightCm) : ""}
              onChangeText={(t) => {
                const n = parseInt(t, 10);
                updateEditingHorse({ heightCm: Number.isNaN(n) ? null : Math.max(1, Math.min(n, 250)) });
              }}
            />
          </Field>
        </View>
        <View className="flex-1">
          <Field label={tr("Poids (kg)")}>
            <TextInput
              className={INPUT}
              placeholder={tr("Ex : 550")}
              keyboardType="number-pad"
              maxLength={4}
              value={editingHorse.weightKg ? String(editingHorse.weightKg) : ""}
              onChangeText={(t) => {
                const n = parseInt(t, 10);
                updateEditingHorse({ weightKg: Number.isNaN(n) ? null : Math.max(1, Math.min(n, 1500)) });
              }}
            />
          </Field>
        </View>
      </View>
    </OnboardingShell>
    <PickerOverlaySlot />
    </>
  );
}
