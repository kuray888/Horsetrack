import { useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { ModalHeader } from "@/components/ModalHeader";
import { useThemeColors } from "@/theme/ThemeProvider";
import { hapticError, hapticSelection } from "@/lib/haptics";
import { track } from "@/lib/analytics";
import { LANG, t } from "@/i18n";
import {
  LANGUAGES,
  LANG_PREF_KEY,
  langFromLocale,
  parseLangPreference,
  resolveLang,
  type LangPreference,
} from "@/i18n/langs";

const CARD = "rounded-card bg-surface p-5 shadow-card";

function deviceLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale ?? "fr";
  } catch {
    return "fr";
  }
}

function storedPreference(): LangPreference {
  try {
    return parseLangPreference(SecureStore.getItem(LANG_PREF_KEY));
  } catch {
    return "auto";
  }
}

const nameOf = (code: string) => LANGUAGES.find((l) => l.code === code)?.name ?? code;

/**
 * Choix de la langue de l'app (Profil → Langue) : Automatique (celle du
 * téléphone) ou une langue précise. Le choix est gardé dans le trousseau et
 * s'applique à la réouverture de l'app : des textes sont construits au
 * démarrage (cf. i18n/index.ts), les changer à chaud en laisserait dans
 * l'ancienne langue. Les noms de langues restent écrits dans leur langue.
 */
export default function LanguageScreen() {
  const colors = useThemeColors();
  const [pref, setPref] = useState<LangPreference>(storedPreference);

  const options: { value: LangPreference; label: string; detail?: string }[] = [
    { value: "auto", label: t("Automatique"), detail: nameOf(langFromLocale(deviceLocale())) },
    ...LANGUAGES.map((l) => ({ value: l.code as LangPreference, label: l.name })),
  ];

  async function choose(next: LangPreference) {
    if (next === pref) return;
    hapticSelection();
    try {
      await SecureStore.setItemAsync(LANG_PREF_KEY, next);
    } catch {
      hapticError();
      Alert.alert(t("Langue non enregistrée"), t("Le choix n'a pas pu être enregistré. Réessaie dans un instant."));
      return;
    }
    setPref(next);
    const resolved = resolveLang(next, deviceLocale());
    track("language_changed", { choice: next, language: resolved, changed: resolved !== LANG });
    // La langue affichée ne change qu'à la réouverture : on le dit.
    if (resolved !== LANG) {
      Alert.alert(
        t("Langue enregistrée"),
        t("Ferme complètement Horsetrack puis rouvre-la pour appliquer {language}.", { language: nameOf(resolved) }),
        [{ text: t("OK"), onPress: () => router.back() }]
      );
    }
  }

  return (
    <Screen>
      <ModalHeader title={t("Langue")} />
      <FadeInView delay={40}>
        <View className={`${CARD} gap-1`} accessibilityRole="radiogroup">
          {options.map((opt, i) => {
            const selected = opt.value === pref;
            return (
              <View key={opt.value}>
                {i > 0 ? <View className="border-t border-border" /> : null}
                <TouchableOpacity
                  onPress={() => void choose(opt.value)}
                  activeOpacity={0.7}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={opt.detail ? `${opt.label}, ${opt.detail}` : opt.label}
                  className="min-h-[44px] flex-row items-center gap-3 py-3"
                >
                  <View className="flex-1">
                    <Text className="text-body font-semibold text-text">{opt.label}</Text>
                    {opt.detail ? <Text className="text-footnote text-muted">{opt.detail}</Text> : null}
                  </View>
                  {selected ? <MaterialCommunityIcons name="check" size={22} color={colors.primary} /> : null}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </FadeInView>
      <FadeInView delay={80}>
        <Text className="text-footnote text-muted">
          {t("Automatique suit la langue de ton iPhone. Le changement s'applique quand tu rouvres l'app.")}
        </Text>
      </FadeInView>
    </Screen>
  );
}
