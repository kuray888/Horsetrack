import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Image } from "@/components/AppImage";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { OnboardingShell } from "@/components/onboarding";
import { Field } from "@/components/Field";
import { useOnboarding } from "@/onboarding/store";
import { TOTAL_STEPS } from "@/onboarding/options";
import { chooseAndPersistImage } from "@/lib/imagePicker";
import { useThemeColors } from "@/theme/ThemeProvider";
import { t } from "@/i18n";

const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

/** Le cheval, réduit à l'essentiel : son nom (seul champ obligatoire) et,
 * si on veut, sa photo — celle qu'on retrouve ensuite sur l'Accueil et le
 * paywall. Race, robe, âge, taille et poids se complètent depuis sa fiche. */
export default function HorseBasics() {
  const colors = useThemeColors();
  const { editingHorse, updateEditingHorse } = useOnboarding();
  const canContinue = editingHorse.name.trim().length > 0;

  async function pickPhoto() {
    const uri = await chooseAndPersistImage();
    if (uri) updateEditingHorse({ photoUrl: uri });
  }

  function next() {
    if (canContinue) router.push("/(onboarding)/first-action");
  }

  return (
    <OnboardingShell
      stepId="horse_basics"
      step={2}
      total={TOTAL_STEPS}
      title={t("Comment s'appelle ton cheval ?")}
      subtitle={t("Le reste de sa fiche se complète quand tu veux.")}
      ctaDisabled={!canContinue}
      onNext={next}
      ctaTestID="horse-basics-continue"
    >
      <View className="items-center gap-2">
        <TouchableOpacity
          onPress={pickPhoto}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={editingHorse.photoUrl ? t("Changer la photo") : t("Choisir une photo du cheval")}
          className="h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-dashed border-border bg-surface"
        >
          {editingHorse.photoUrl ? (
            <Image source={{ uri: editingHorse.photoUrl }} style={{ width: 112, height: 112 }} contentFit="cover" />
          ) : (
            <MaterialCommunityIcons name="camera-plus-outline" size={28} color={colors.textMuted} />
          )}
        </TouchableOpacity>
        <Text className="text-[13px] text-muted">
          {editingHorse.photoUrl ? t("Changer la photo") : t("Ajouter une photo (facultatif)")}
        </Text>
      </View>

      <Field label={t("Nom du cheval")}>
        <TextInput
          className={INPUT}
          placeholder={t("Ex : Quabar des Monts")}
          value={editingHorse.name}
          onChangeText={(name) => updateEditingHorse({ name })}
          autoCapitalize="words"
          autoCorrect={false}
          autoFocus
          returnKeyType="next"
          onSubmitEditing={next}
          testID="horse-basics-name"
        />
      </Field>
    </OnboardingShell>
  );
}
