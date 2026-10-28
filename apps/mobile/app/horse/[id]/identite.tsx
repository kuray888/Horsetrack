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
import { hapticSuccess } from "@/lib/haptics";
import { saveHorseDetails, useHorseDetails } from "@/extras/store";
import { isPlausibleMicrochip, isPlausibleSire, isPlausibleUeln, type HorseIdentity } from "@/extras/model";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface p-4 text-base text-text";

/**
 * Carte d'identité du cheval : SIRE, UELN, transpondeur, assurance, écurie —
 * ce qu'on cherche au moment d'engager en concours, chez le véto ou pour une
 * déclaration d'assurance. Les formats sont vérifiés à titre indicatif : un
 * numéro inhabituel est signalé, jamais refusé.
 */
export default function HorseIdentityScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { horses } = useHorses();
  const horse = horses.find((h) => h.id === id);
  const details = useHorseDetails(id);
  const [draft, setDraft] = useState<HorseIdentity | null>(null);
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

  const value = draft ?? details.identity;
  const set = (patch: Partial<HorseIdentity>) => {
    setDraft({ ...value, ...patch });
    setSaved(false);
  };

  function handleSave() {
    if (!draft) return;
    saveHorseDetails(horse!.id, { identity: draft });
    setDraft(null);
    setSaved(true);
    hapticSuccess();
  }

  const field = (
    label: string,
    key: keyof HorseIdentity,
    placeholder: string,
    opts: { warn?: boolean; caps?: boolean; numeric?: boolean } = {}
  ) => (
    <Field label={label}>
      <TextInput
        className={INPUT}
        value={value[key]}
        onChangeText={(v) => set({ [key]: v } as Partial<HorseIdentity>)}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize={opts.caps ? "characters" : "sentences"}
        autoCorrect={false}
        keyboardType={opts.numeric ? "number-pad" : "default"}
        maxLength={80}
      />
      {opts.warn ? (
        <Text className="text-xs text-warning">{t("Format inhabituel : vérifie le numéro sur le passeport.")}</Text>
      ) : null}
    </Field>
  );

  return (
    <Screen>
      <FadeInView>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 gap-0.5">
            <Text className="text-2xl font-display tracking-tight text-text" accessibilityRole="header">
              {t("Identité")}
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
          {field(t("Numéro SIRE"), "sire", "25012345K", { caps: true, warn: !isPlausibleSire(value.sire) })}
          {field(t("UELN"), "ueln", "250001A12345678", { caps: true, warn: !isPlausibleUeln(value.ueln) })}
          {field(t("Transpondeur (puce)"), "microchip", "250259600123456", {
            numeric: true,
            warn: !isPlausibleMicrochip(value.microchip),
          })}
        </View>
      </FadeInView>

      <FadeInView delay={80}>
        <View className={`${CARD} gap-4`}>
          {field(t("Assureur"), "insurer", t("Ex : Equiassur"))}
          {field(t("Numéro de contrat"), "insurancePolicy", t("Ex : 123456789"), { caps: true })}
          {field(t("Écurie / pension"), "stable", t("Ex : Écurie du Val"))}
        </View>
      </FadeInView>

      <FadeInView delay={120}>
        <PrimaryButton label={saved && !draft ? t("Enregistré ✓") : t("Enregistrer")} onPress={handleSave} disabled={!draft} />
        <Text className="pt-2 text-center text-xs text-muted">
          {t("Visible aussi par les personnes avec qui tu partages ce cheval.")}
        </Text>
      </FadeInView>
    </Screen>
  );
}
