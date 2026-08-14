import { useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { PrimaryButton, SingleSelect } from "@/components/onboarding";
import { Field } from "@/components/Field";
import { DISCIPLINES, PREFERRED_TIMES, RIDER_GOALS, RIDER_LEVELS, RIDE_FREQUENCIES } from "@/onboarding/options";
import { useRiderProfile } from "@/rider/store";
import type { Discipline, RiderGoal, RiderLevel, RideFrequency, PreferredTime } from "@/onboarding/store";

const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

export default function EditRiderModal() {
  const { riderProfile, setRiderProfile } = useRiderProfile();
  const [level, setLevel] = useState<RiderLevel | null>(riderProfile.level);
  const [mainDiscipline, setMainDiscipline] = useState<Discipline | null>(riderProfile.mainDiscipline);
  const [rideFrequency, setRideFrequency] = useState<RideFrequency | null>(riderProfile.rideFrequency);
  const [preferredTime, setPreferredTime] = useState<PreferredTime | null>(riderProfile.preferredTime);
  const [primaryGoal, setPrimaryGoal] = useState<RiderGoal | null>(riderProfile.primaryGoal);
  const [additionalInfo, setAdditionalInfo] = useState(riderProfile.additionalInfo);

  const canSave =
    level !== null && mainDiscipline !== null && rideFrequency !== null && preferredTime !== null && primaryGoal !== null;

  function submit() {
    if (!canSave) return;
    setRiderProfile({ level, mainDiscipline, rideFrequency, preferredTime, primaryGoal, additionalInfo });
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between px-5 pt-2">
        <Text className="text-2xl font-extrabold tracking-tight text-text">Mon profil cavalier</Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text className="text-xl text-muted">✕</Text>
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

        <Field label="Créneau habituel">
          <SingleSelect options={PREFERRED_TIMES} value={preferredTime} onChange={setPreferredTime} />
        </Field>

        <Field label="Objectif principal">
          <SingleSelect options={RIDER_GOALS} value={primaryGoal} onChange={setPrimaryGoal} />
        </Field>

        <Field label="Pour Julien (optionnel)">
          <TextInput
            className={INPUT}
            placeholder="Objectifs précis, contraintes, ce qui compte pour toi…"
            value={additionalInfo}
            onChangeText={setAdditionalInfo}
            multiline
            numberOfLines={5}
            style={{ minHeight: 120, textAlignVertical: "top" }}
          />
        </Field>
      </ScrollView>

      <View className="px-5 pb-2 pt-3">
        <PrimaryButton label="Enregistrer" disabled={!canSave} onPress={submit} />
      </View>
    </SafeAreaView>
  );
}
