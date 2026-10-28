import { useState } from "react";
import { Share, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { Field } from "@/components/Field";
import { PrimaryButton } from "@/components/onboarding";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { hapticSuccess } from "@/lib/haptics";
import { saveHorseDetails, useHorseDetails } from "@/extras/store";
import { hasFeeding, type FeedingPlan } from "@/extras/model";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

/**
 * Ration du cheval : repas par repas, foin, compléments, consignes. Partagée
 * avec la demi-pension et le coach (cf. extras/model.ts) — c'est souvent
 * quelqu'un d'autre qui nourrit, et c'est là que les erreurs arrivent.
 */
export default function HorseFeedingScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { horses } = useHorses();
  const horse = horses.find((h) => h.id === id);
  const details = useHorseDetails(id);
  const [draft, setDraft] = useState<FeedingPlan | null>(null);
  const [saved, setSaved] = useState(false);

  if (!horse || !details) {
    return (
      <Screen>
        <View className={`${CARD} items-center gap-2`}>
          <MaterialCommunityIcons name="horse-variant" size={28} color={colors.textMuted} />
          <Text className="text-sm text-muted">{t("Ce cheval est introuvable.")}</Text>
        </View>
      </Screen>
    );
  }

  const plan = draft ?? details.feeding;
  const update = (next: FeedingPlan) => {
    setDraft(next);
    setSaved(false);
  };

  function handleSave() {
    if (!draft) return;
    // Repas sans nom ni ration : retirés, ils n'apporteraient que du bruit.
    const meals = draft.meals.filter((m) => m.label.trim() || m.ration.trim());
    saveHorseDetails(horse!.id, { feeding: { ...draft, meals } });
    setDraft(null);
    setSaved(true);
    hapticSuccess();
  }

  function handleShare() {
    const lines = [
      t("Ration de {name}", { name: horse!.name }),
      ...plan.meals.filter((m) => m.ration.trim()).map((m) => `• ${m.label} : ${m.ration}`),
      plan.hay.trim() ? `• ${t("Foin")} : ${plan.hay}` : "",
      plan.supplements.trim() ? `• ${t("Compléments")} : ${plan.supplements}` : "",
      plan.notes.trim() ? `\n${plan.notes}` : "",
    ].filter(Boolean);
    void Share.share({ message: lines.join("\n") });
  }

  return (
    <Screen>
      <FadeInView>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 gap-0.5">
            <Text className="text-2xl font-display tracking-tight text-text" accessibilityRole="header">
              {t("Alimentation")}
            </Text>
            <Text className="text-sm text-muted">{horse.name}</Text>
          </View>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel={t("Fermer")} accessibilityRole="button">
            <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </FadeInView>

      <FadeInView delay={40}>
        <View className={`${CARD} gap-4`}>
          <Text className="text-xs font-bold uppercase tracking-wide text-muted">{t("Repas")}</Text>
          {plan.meals.map((meal, i) => (
            <View key={meal.id} className="gap-2">
              <View className="flex-row items-center gap-2">
                <TextInput
                  className="flex-1 text-base font-semibold text-text"
                  value={meal.label}
                  onChangeText={(label) =>
                    update({ ...plan, meals: plan.meals.map((m, j) => (j === i ? { ...m, label } : m)) })
                  }
                  placeholder={t("Nom du repas")}
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel={t("Nom du repas {n}", { n: i + 1 })}
                  maxLength={40}
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t("Retirer le repas {label}", { label: meal.label || String(i + 1) })}
                  hitSlop={8}
                  onPress={() => update({ ...plan, meals: plan.meals.filter((_, j) => j !== i) })}
                >
                  <MaterialCommunityIcons name="close-circle-outline" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <TextInput
                className={INPUT}
                value={meal.ration}
                onChangeText={(ration) =>
                  update({ ...plan, meals: plan.meals.map((m, j) => (j === i ? { ...m, ration } : m)) })
                }
                placeholder={t("Ex : 2 kg de granulés + 1 mesure d'orge")}
                placeholderTextColor={colors.textMuted}
                accessibilityLabel={t("Ration du repas {label}", { label: meal.label || String(i + 1) })}
                multiline
                maxLength={300}
              />
            </View>
          ))}
          {plan.meals.length < 6 ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() =>
                update({ ...plan, meals: [...plan.meals, { id: `m${Date.now().toString(36)}`, label: "", ration: "" }] })
              }
            >
              <Text className="text-sm font-semibold text-accent">{t("+ Ajouter un repas")}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </FadeInView>

      <FadeInView delay={80}>
        <View className={`${CARD} gap-4`}>
          <Field label={t("Foin")}>
            <TextInput
              className={INPUT}
              value={plan.hay}
              onChangeText={(hay) => update({ ...plan, hay })}
              placeholder={t("Ex : à volonté, ou 8 kg par jour")}
              placeholderTextColor={colors.textMuted}
              maxLength={200}
            />
          </Field>
          <Field label={t("Compléments")}>
            <TextInput
              className={INPUT}
              value={plan.supplements}
              onChangeText={(supplements) => update({ ...plan, supplements })}
              placeholder={t("Ex : électrolytes après l'effort")}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={300}
            />
          </Field>
          <Field label={t("Consignes")}>
            <TextInput
              className={INPUT}
              value={plan.notes}
              onChangeText={(notes) => update({ ...plan, notes })}
              placeholder={t("Allergies, ce qu'il ne faut jamais donner, eau…")}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={600}
            />
          </Field>
        </View>
      </FadeInView>

      <FadeInView delay={120}>
        <View className="gap-3">
          <PrimaryButton label={saved && !draft ? t("Enregistré ✓") : t("Enregistrer")} onPress={handleSave} disabled={!draft} />
          {hasFeeding(plan) ? (
            <TouchableOpacity className="items-center p-2" accessibilityRole="button" onPress={handleShare}>
              <Text className="text-sm font-semibold text-accent">{t("Envoyer la ration par message")}</Text>
            </TouchableOpacity>
          ) : null}
          <Text className="text-center text-xs text-muted">
            {t("Visible aussi par les personnes avec qui tu partages ce cheval.")}
          </Text>
        </View>
      </FadeInView>
    </Screen>
  );
}
