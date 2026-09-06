import { useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { PrimaryButton, SingleSelect } from "@/components/onboarding";
import { Field } from "@/components/Field";
import { DISCIPLINES, OTHER_OPTION, RIDER_GOALS, RIDER_LEVELS, RIDE_FREQUENCIES } from "@/onboarding/options";
import { useRiderProfile } from "@/rider/store";
import { colors } from "@/theme/colors";
import type { Discipline, RiderGoal, RiderLevel, RideFrequency } from "@/onboarding/store";

const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

/** Même sentinelle `OTHER_OPTION` que goal-modal.tsx (objectifs par cheval) —
 * cohérence "Autre → Précisez votre objectif" entre cavalier et cheval. */
type GoalSelection = RiderGoal | typeof OTHER_OPTION;

const GOAL_OPTIONS: { value: GoalSelection; label: string }[] = [...RIDER_GOALS, { value: OTHER_OPTION, label: "Autre" }];

export default function EditRiderModal() {
  const { riderProfile, setRiderProfile } = useRiderProfile();
  const [level, setLevel] = useState<RiderLevel | null>(riderProfile.level);
  const [mainDiscipline, setMainDiscipline] = useState<Discipline | null>(riderProfile.mainDiscipline);
  const [rideFrequency, setRideFrequency] = useState<RideFrequency | null>(riderProfile.rideFrequency);
  const [primaryGoal, setPrimaryGoal] = useState<GoalSelection | null>(
    riderProfile.primaryGoalCustom ? OTHER_OPTION : riderProfile.primaryGoal
  );
  const [primaryGoalCustom, setPrimaryGoalCustom] = useState(riderProfile.primaryGoalCustom ?? "");

  const canSave =
    level !== null &&
    mainDiscipline !== null &&
    rideFrequency !== null &&
    primaryGoal !== null &&
    (primaryGoal !== OTHER_OPTION || primaryGoalCustom.trim().length > 0);

  function submit() {
    if (!canSave || primaryGoal === null) return;
    setRiderProfile({
      level,
      mainDiscipline,
      rideFrequency,
      primaryGoal: primaryGoal === OTHER_OPTION ? null : primaryGoal,
      primaryGoalCustom: primaryGoal === OTHER_OPTION ? primaryGoalCustom.trim() || null : null,
    });
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between px-5 pt-2">
        <Text className="text-2xl font-display tracking-tight text-text">Mon profil cavalier</Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Fermer" accessibilityRole="button">
          <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} accessibilityElementsHidden />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerClassName="gap-5 px-5 pt-6 pb-4" showsVerticalScrollIndicator={false}>
        <Field label="Niveau">
          <SingleSelect options={RIDER_LEVELS} value={level} onChange={setLevel} />
        </Field>

        <Field label="Discipline principale">
          <SingleSelect options={DISCIPLINES} value={mainDiscipline} onChange={setMainDiscipline} />
        </Field>

        <Field label="Fréquence de monte">
          <SingleSelect options={RIDE_FREQUENCIES} value={rideFrequency} onChange={setRideFrequency} />
        </Field>

        <Field label="Objectif principal">
          <SingleSelect options={GOAL_OPTIONS} value={primaryGoal} onChange={setPrimaryGoal} />
        </Field>

        {primaryGoal === OTHER_OPTION ? (
          <Field label="Précisez votre objectif">
            <TextInput
              className={INPUT}
              placeholder="Ex : Reprendre confiance à cheval"
              value={primaryGoalCustom}
              onChangeText={setPrimaryGoalCustom}
              autoCapitalize="sentences"
            />
          </Field>
        ) : null}
      </ScrollView>

      <View className="px-5 pb-2 pt-3">
        <PrimaryButton label="Enregistrer" disabled={!canSave} onPress={submit} />
      </View>
    </SafeAreaView>
  );
}
