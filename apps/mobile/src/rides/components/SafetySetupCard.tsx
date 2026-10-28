import { Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Field } from "@/components/Field";
import { useThemeColors } from "@/theme/ThemeProvider";
import { openPaywall } from "@/subscription/paywall";
import type { SafetySettings } from "@/rides/safety";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const INPUT = "rounded-card border border-border bg-surface px-4 py-3 text-base text-text";

/**
 * « Prévenir mes proches » — réglage de la sécurité en balade, avant le
 * départ. Premium : sinon, la carte présente la fonction et ouvre le paywall.
 */
export function SafetySetupCard({
  premium,
  settings,
  onChange,
}: {
  premium: boolean;
  settings: SafetySettings;
  onChange: (next: SafetySettings) => void;
}) {
  const colors = useThemeColors();

  if (!premium) {
    return (
      <TouchableOpacity
        className={`${CARD} flex-row items-center gap-3`}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityHint={t("Ouvre l'offre Premium")}
        onPress={() => openPaywall("ride_safety", { feature: "ride_safety" })}
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-highlight">
          <MaterialCommunityIcons name="shield-account-outline" size={20} color={colors.primary} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold text-text">{t("Prévenir mes proches")}</Text>
          <Text className="text-xs text-muted">
            {t("Ils suivent ta position et reçoivent une alerte si tu ne bouges plus. Premium.")}
          </Text>
        </View>
        <MaterialCommunityIcons name="lock-outline" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    );
  }

  const contacts = settings.contacts.length ? settings.contacts : [{ name: "", email: "" }];
  const setContact = (index: number, patch: Partial<{ name: string; email: string }>) => {
    const next = contacts.map((c, i) => (i === index ? { ...c, ...patch } : c));
    onChange({ ...settings, contacts: next });
  };

  return (
    <View className={`${CARD} gap-4`}>
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-highlight">
          <MaterialCommunityIcons name="shield-account-outline" size={20} color={colors.primary} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold text-text">{t("Prévenir mes proches")}</Text>
          <Text className="text-xs text-muted">
            {t("Lien de suivi par email au départ. Si tu ne bouges plus 5 min et ne réponds pas, ils sont alertés.")}
          </Text>
        </View>
        <Switch
          value={settings.enabled}
          onValueChange={(enabled) => onChange({ ...settings, enabled })}
          trackColor={{ true: colors.primary, false: colors.border }}
          accessibilityLabel={t("Prévenir mes proches")}
        />
      </View>

      {settings.enabled ? (
        <View className="gap-4">
          <Field label={t("Ton prénom (lu par tes proches)")}>
            <TextInput
              className={INPUT}
              value={settings.riderName}
              onChangeText={(riderName) => onChange({ ...settings, riderName })}
              placeholder={t("Léa")}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              maxLength={60}
            />
          </Field>
          {contacts.map((c, i) => (
            <View key={i} className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-muted">{t("Proche ")}{i + 1}</Text>
                {contacts.length > 1 ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t("Retirer le proche {v}", { v: i + 1 })}
                    hitSlop={8}
                    onPress={() => onChange({ ...settings, contacts: contacts.filter((_, j) => j !== i) })}
                  >
                    <Text className="text-xs font-semibold text-danger">{t("Retirer")}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <TextInput
                className={INPUT}
                value={c.name}
                onChangeText={(name) => setContact(i, { name })}
                placeholder={t("Nom (ex. Maman)")}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                maxLength={60}
                accessibilityLabel={t("Nom du proche {v}", { v: i + 1 })}
              />
              <TextInput
                className={INPUT}
                value={c.email}
                onChangeText={(email) => setContact(i, { email })}
                placeholder={t("Email")}
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={200}
                accessibilityLabel={t("Email du proche {v}", { v: i + 1 })}
              />
            </View>
          ))}
          {contacts.length < 3 ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => onChange({ ...settings, contacts: [...contacts, { name: "", email: "" }] })}
            >
              <Text className="text-sm font-semibold text-accent">{t("+ Ajouter un proche")}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
