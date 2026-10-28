import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { Field } from "@/components/Field";
import { PrimaryButton } from "@/components/onboarding";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { useSubscription } from "@/subscription/store";
import { openPaywall } from "@/subscription/paywall";
import { hapticSuccess } from "@/lib/haptics";
import { DAY_LABELS, WEEK_DAYS_FULL } from "@/lib/dateFormat";
import { saveHorseDetails, useHorseDetails } from "@/extras/store";
import type { Partnership } from "@/extras/model";
import { localDecimal, t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

/**
 * Demi-pension (Premium) : qui monte le cheval, quels jours, et combien elle
 * participe chaque mois. L'Accueil annonce « C'est le jour de Léa », le
 * Budget déduit sa participation pour montrer ce qui reste à ta charge.
 * L'accès au cheval lui-même se donne depuis « Partager l'accès ».
 */
export default function PartnershipScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { horses } = useHorses();
  const { isActiveOrTrialing } = useSubscription();
  const horse = horses.find((h) => h.id === id);
  const details = useHorseDetails(id);
  const [draft, setDraft] = useState<(Partnership & { feeText: string }) | null>(null);
  const [saved, setSaved] = useState(false);

  if (!horse || !details) {
    return (
      <Screen>
        <Text className="text-sm text-muted">{t("Ce cheval est introuvable.")}</Text>
      </Screen>
    );
  }

  const current = draft ?? {
    ...details.partnership,
    feeText: details.partnership.monthlyFee !== null ? localDecimal(String(details.partnership.monthlyFee)) : "",
  };
  const update = (patch: Partial<Partnership & { feeText: string }>) => {
    setDraft({ ...current, ...patch });
    setSaved(false);
  };

  function handleSave() {
    if (!draft) return;
    const fee = Number(draft.feeText.replace(",", "."));
    const { feeText: _f, ...rest } = draft;
    saveHorseDetails(horse!.id, {
      partnership: { ...rest, riderName: rest.riderName.trim(), monthlyFee: Number.isFinite(fee) && fee > 0 ? fee : null },
    });
    setDraft(null);
    setSaved(true);
    hapticSuccess();
  }

  const header = (
    <View className="flex-row items-center justify-between">
      <View className="flex-1 gap-0.5">
        <Text className="text-2xl font-display tracking-tight text-text" accessibilityRole="header">
          {t("Demi-pension")}
        </Text>
        <Text className="text-sm text-muted">{horse.name}</Text>
      </View>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel={t("Fermer")} accessibilityRole="button">
        <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );

  if (!isActiveOrTrialing) {
    return (
      <Screen>
        {header}
        <View className={`${CARD} gap-3`}>
          <Text className="text-base font-semibold text-text">{t("Organise la demi-pension")}</Text>
          <Text className="text-sm text-muted">
            {t("Ses jours de monte, sa participation aux frais, ce qui reste à ta charge : tout est clair pour vous deux.")}
          </Text>
          <PrimaryButton label={t("Découvrir Premium")} onPress={() => openPaywall("sharing", { feature: "partnership" })} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FadeInView>{header}</FadeInView>

      <FadeInView delay={40}>
        <View className={`${CARD} gap-4`}>
          <Field label={t("Prénom de la demi-pension")}>
            <TextInput
              className={INPUT}
              value={current.riderName}
              onChangeText={(riderName) => update({ riderName })}
              placeholder={t("Léa")}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              maxLength={40}
            />
          </Field>
          <Field label={t("Ses jours")}>
            <View className="flex-row justify-between">
              {DAY_LABELS.map((label, i) => {
                const day = i + 1;
                const on = current.days.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={WEEK_DAYS_FULL[i]}
                    onPress={() =>
                      update({ days: on ? current.days.filter((d) => d !== day) : [...current.days, day].sort() })
                    }
                    className={`h-10 w-10 items-center justify-center rounded-full ${on ? "bg-primary" : "border border-border bg-surface"}`}
                  >
                    <Text className={`font-bold ${on ? "text-on-primary" : "text-text"}`}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>
          <Field label={t("Participation mensuelle (€, optionnel)")}>
            <TextInput
              className={INPUT}
              value={current.feeText}
              onChangeText={(feeText) => update({ feeText })}
              placeholder={t("Ex : 150")}
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              maxLength={8}
            />
          </Field>
          <Field label={t("Notes (optionnel)")}>
            <TextInput
              className={INPUT}
              value={current.notes}
              onChangeText={(notes) => update({ notes })}
              placeholder={t("Ex : pas d'obstacle, balade le samedi")}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={300}
            />
          </Field>
          <PrimaryButton label={saved && !draft ? t("Enregistré ✓") : t("Enregistrer")} onPress={handleSave} disabled={!draft} />
        </View>
      </FadeInView>

      <FadeInView delay={80}>
        <TouchableOpacity
          className={`${CARD} flex-row items-center gap-3`}
          accessibilityRole="button"
          onPress={() => router.push(`/share-horse-modal?horseId=${horse.id}`)}
        >
          <MaterialCommunityIcons name="account-plus-outline" size={22} color={colors.primary} />
          <View className="flex-1">
            <Text className="text-base font-semibold text-text">{t("Donner accès à la demi-pension")}</Text>
            <Text className="text-xs text-muted">{t("Elle voit le planning, la santé et la ration, et note ses séances.")}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </FadeInView>
    </Screen>
  );
}
