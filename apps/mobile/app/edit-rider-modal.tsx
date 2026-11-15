import { useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton, SingleSelect } from "@/components/onboarding";
import { Field } from "@/components/Field";
import { DISCIPLINES, OTHER_OPTION, RIDER_GOALS, RIDER_LEVELS, RIDE_FREQUENCIES } from "@/onboarding/options";
import { useRiderProfile } from "@/rider/store";
import type { Discipline, RiderGoal, RiderLevel, RideFrequency } from "@/onboarding/store";
import { t } from "@/i18n";
import { KeyboardAvoider } from "@/components/KeyboardAvoider";
import { ModalHeader } from "@/components/ModalHeader";
import { useDiscardGuard } from "@/components/useDiscardGuard";

const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

/** Même sentinelle `OTHER_OPTION` que goal-modal.tsx (objectifs par cheval) —
 * cohérence "Autre → Précisez votre objectif" entre cavalier et cheval. */
type GoalSelection = RiderGoal | typeof OTHER_OPTION;

const GOAL_OPTIONS: { value: GoalSelection; label: string }[] = [...RIDER_GOALS, { value: OTHER_OPTION, label: t("Autre") }];

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
  const dirty =
    level !== riderProfile.level ||
    mainDiscipline !== riderProfile.mainDiscipline ||
    rideFrequency !== riderProfile.rideFrequency ||
    primaryGoal !== (riderProfile.primaryGoalCustom ? OTHER_OPTION : riderProfile.primaryGoal) ||
    primaryGoalCustom !== (riderProfile.primaryGoalCustom ?? "");
  const { leave } = useDiscardGuard(dirty);

  function submit() {
    if (!canSave || primaryGoal === null) return;
    setRiderProfile({
      level,
      mainDiscipline,
      rideFrequency,
      primaryGoal: primaryGoal === OTHER_OPTION ? null : primaryGoal,
      primaryGoalCustom: primaryGoal === OTHER_OPTION ? primaryGoalCustom.trim() || null : null,
    });
    leave();
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <KeyboardAvoider>
        <View className="px-5 pt-2">
          <ModalHeader title={t("Mon profil cavalier")} />
        </View>

        <ScrollView
          contentContainerClassName="gap-5 px-5 pt-6 pb-4"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Field label={t("Niveau")}>
            <SingleSelect options={RIDER_LEVELS} value={level} onChange={setLevel} />
          </Field>

          <Field label={t("Discipline principale")}>
            <SingleSelect options={DISCIPLINES} value={mainDiscipline} onChange={setMainDiscipline} />
          </Field>

          <Field label={t("Fréquence de monte")}>
            <SingleSelect options={RIDE_FREQUENCIES} value={rideFrequency} onChange={setRideFrequency} />
          </Field>

          <Field label={t("Objectif principal")}>
            <SingleSelect options={GOAL_OPTIONS} value={primaryGoal} onChange={setPrimaryGoal} />
          </Field>

          {primaryGoal === OTHER_OPTION ? (
            <Field label={t("Précisez votre objectif")}>
              <TextInput
                className={INPUT}
                placeholder={t("Ex : Reprendre confiance à cheval")}
                value={primaryGoalCustom}
                onChangeText={setPrimaryGoalCustom}
                autoCapitalize="sentences"
              />
            </Field>
          ) : null}
        </ScrollView>

        <View className="px-5 pb-2 pt-3">
          <PrimaryButton label={t("Enregistrer")} disabled={!canSave} onPress={submit} />
        </View>
      </KeyboardAvoider>
    </SafeAreaView>
  );
}
