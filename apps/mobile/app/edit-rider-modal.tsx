import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { PrimaryButton, SingleSelect } from "@/components/onboarding";
import { Field } from "@/components/Field";
import { DISCIPLINES, RIDER_GOALS, RIDER_LEVELS, RIDE_FREQUENCIES } from "@/onboarding/options";
import { useRiderProfile } from "@/rider/store";
import { colors } from "@/theme/colors";
import type { Discipline, RiderGoal, RiderLevel, RideFrequency } from "@/onboarding/store";

export default function EditRiderModal() {
  const { riderProfile, setRiderProfile } = useRiderProfile();
  const [level, setLevel] = useState<RiderLevel | null>(riderProfile.level);
  const [mainDiscipline, setMainDiscipline] = useState<Discipline | null>(riderProfile.mainDiscipline);
  const [rideFrequency, setRideFrequency] = useState<RideFrequency | null>(riderProfile.rideFrequency);
  const [primaryGoal, setPrimaryGoal] = useState<RiderGoal | null>(riderProfile.primaryGoal);

  const canSave = level !== null && mainDiscipline !== null && rideFrequency !== null && primaryGoal !== null;

  function submit() {
    if (!canSave) return;
    setRiderProfile({ level, mainDiscipline, rideFrequency, primaryGoal });
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between px-5 pt-2">
        <Text className="text-2xl font-extrabold tracking-tight text-text">Mon profil cavalier</Text>
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
          <SingleSelect options={RIDER_GOALS} value={primaryGoal} onChange={setPrimaryGoal} />
        </Field>
      </ScrollView>

      <View className="px-5 pb-2 pt-3">
        <PrimaryButton label="Enregistrer" disabled={!canSave} onPress={submit} />
      </View>
    </SafeAreaView>
  );
}
