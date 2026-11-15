import { useEffect, useState } from "react";
import { Animated, Easing, View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Image } from "@/components/AppImage";
import { useThemeColors } from "@/theme/ThemeProvider";
import { PrimaryButton, ProgressBar } from "@/components/onboarding";
import { FadeInView } from "@/components/FadeInView";
import { useOnboarding } from "@/onboarding/store";
import { useAdvanceGuard } from "@/onboarding/useAdvanceGuard";
import { DISCIPLINES } from "@/onboarding/options";
import { firstActionDate, type FirstActionDraft } from "@/onboarding/firstAction";
import { APPT_META } from "@/agenda/meta";
import { ACTIVITY_META } from "@/agenda/store";
import { formatDate } from "@/lib/dateFormat";
import { hapticSuccess } from "@/lib/haptics";
import { prefersReducedMotion } from "@/lib/motion";
import { track } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";
import { t } from "@/i18n";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Coche de réussite : apparaît en grossissant (ressort), une seule fois.
 * Sans animation si « Réduire les animations » est activé. */
function SuccessBadge() {
  const colors = useThemeColors();
  const reduce = prefersReducedMotion();
  const [scale] = useState(() => new Animated.Value(reduce ? 1 : 0.4));
  const [opacity] = useState(() => new Animated.Value(reduce ? 1 : 0));
  useEffect(() => {
    if (reduce) return;
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [reduce, scale, opacity]);
  return (
    <Animated.View
      style={{ transform: [{ scale }], opacity }}
      className="h-16 w-16 items-center justify-center rounded-full bg-primary"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <MaterialCommunityIcons name="check-bold" size={28} color={colors.textOnPrimary} />
    </Animated.View>
  );
}

/** Ce qui vient d'être noté, en une ligne : « Maréchal-ferrant · 28 nov. 2026 ». */
function actionLine(action: FirstActionDraft): { icon: IconName; label: string; date: Date | null } {
  const date = firstActionDate(action);
  if (action.kind === "care") {
    return { icon: APPT_META[action.careType].icon.name as IconName, label: APPT_META[action.careType].label, date };
  }
  return { icon: ACTIVITY_META[action.activity].icon, label: ACTIVITY_META[action.activity].label, date };
}

function ChecklistRow({ done, label, hint }: { done: boolean; label: string; hint?: string }) {
  const colors = useThemeColors();
  return (
    <View className="flex-row items-start gap-3" accessible accessibilityLabel={`${label}${done ? `, ${t("fait")}` : ""}`}>
      <MaterialCommunityIcons
        name={done ? "check-circle" : "checkbox-blank-circle-outline"}
        size={24}
        color={done ? colors.success : colors.textMuted}
      />
      <View className="flex-1 gap-1">
        <Text className={`text-[15px] font-semibold ${done ? "text-muted line-through" : "text-text"}`}>{label}</Text>
        {hint ? <Text className="text-[13px] text-muted">{hint}</Text> : null}
      </View>
    </View>
  );
}

/**
 * Récompense de l'onboarding, juste avant le compte : le cavalier voit son
 * cheval et ce qu'il vient de noter (premier succès), avec une coche animée
 * et une vibration de réussite. La progression « 2 sur 3 » est vraie : il
 * reste le compte, qui sauvegarde tout (cf. account.tsx).
 */
export default function Summary() {
  const colors = useThemeColors();
  const { rider, horses, firstAction } = useOnboarding();
  const primary = horses.find((h) => h.isPrimary) ?? horses[0];
  const horseName = primary?.name?.trim() || t("ton cheval");
  const disciplineLabel = DISCIPLINES.find((d) => d.value === (primary?.discipline ?? rider.mainDiscipline))?.label ?? null;
  const action = firstAction ? actionLine(firstAction) : null;
  const careWithReminder = firstAction?.kind === "care" && firstAction.reminder;
  const [hasSession, setHasSession] = useState(false);
  const guard = useAdvanceGuard();

  useEffect(() => {
    track("onboarding_step_viewed", { step: "summary", first_action: firstAction?.kind ?? "none" });
    if (firstAction) hapticSuccess();
    supabase.auth
      .getSession()
      .then(({ data }) => setHasSession(!!data.session))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Parcours « j'ai un cheval » : le compte se crée ici, après avoir vu ce
  // qu'il va garder. Déjà connecté (parcours invité, ou session restée dans
  // le trousseau) : directement le paywall.
  async function next() {
    if (!guard.tryAdvance()) return; // double toucher : un seul écran ouvert
    const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
    router.push(data.session ? "/(onboarding)/paywall" : "/(onboarding)/account");
  }

  const title = firstAction ? t("C'est noté !") : t("{name} est dans ton écurie", { name: horseName });
  const subtitle = !firstAction
    ? t("Tu pourras noter son prochain soin ou sa prochaine séance depuis l'Accueil.")
    : careWithReminder
      ? t("On te prévient la veille, à 9 h. Tu n'as plus à y penser.")
      : firstAction.kind === "care"
        ? t("Son soin est noté dans son carnet de santé.")
        : t("Sa séance t'attend dans ton planning.");
  const doneCount = 1 + (firstAction ? 1 : 0) + (hasSession ? 1 : 0);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScrollView contentContainerClassName="px-5 pt-8 pb-4 gap-6" showsVerticalScrollIndicator={false}>
        <View className="gap-4">
          {firstAction ? <SuccessBadge /> : null}
          <FadeInView delay={firstAction ? 120 : 0}>
            <View className="gap-2">
              <Text className="text-3xl font-display leading-tight tracking-tight text-text" testID="summary-title">
                {title}
              </Text>
              <Text className="text-base text-muted">{subtitle}</Text>
            </View>
          </FadeInView>
        </View>

        <FadeInView delay={200}>
          <View className="gap-4 rounded-card bg-surface p-5 shadow-card">
            <View className="flex-row items-center gap-4">
              <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-highlight">
                {primary?.photoUrl ? (
                  <Image source={{ uri: primary.photoUrl }} style={{ width: 64, height: 64 }} contentFit="cover" />
                ) : (
                  <MaterialCommunityIcons name="horse-variant" size={28} color={colors.primary} />
                )}
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-xl font-display-bold text-text" numberOfLines={1}>
                  {horseName}
                </Text>
                {disciplineLabel ? <Text className="text-[13px] text-muted">{disciplineLabel}</Text> : null}
              </View>
            </View>

            {action ? (
              <View className="flex-row items-center gap-3 rounded-card bg-highlight p-4" testID="summary-first-action">
                <MaterialCommunityIcons name={action.icon} size={24} color={colors.primary} />
                <View className="flex-1 gap-1">
                  <Text className="text-[15px] font-bold text-text">{action.label}</Text>
                  {action.date ? <Text className="text-[13px] text-muted">{formatDate(action.date)}</Text> : null}
                </View>
                {careWithReminder ? (
                  <View className="flex-row items-center gap-1 rounded-full bg-primary px-3 py-1">
                    <MaterialCommunityIcons name="bell-ring-outline" size={16} color={colors.textOnPrimary} />
                    <Text className="text-[11px] font-bold text-on-primary">{t("Rappel la veille")}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </FadeInView>

        <FadeInView delay={280}>
          <View className="gap-4 rounded-card border border-border p-5">
            <View className="gap-2">
              <Text className="text-[13px] font-bold uppercase tracking-wide text-link">
                {t("Ton écurie · {done} sur 3", { done: doneCount })}
              </Text>
              <ProgressBar step={doneCount} total={3} />
            </View>
            <ChecklistRow done label={t("Ajouter {name}", { name: horseName })} />
            <ChecklistRow done={!!firstAction} label={t("Noter son prochain soin ou sa prochaine séance")} />
            <ChecklistRow
              done={hasSession}
              label={t("Sauvegarder ton écurie")}
              hint={t("Ton compte garde tout, sur tous tes appareils.")}
            />
          </View>
        </FadeInView>
      </ScrollView>

      <View className="px-5 pb-2 pt-3">
        <PrimaryButton
          testID="summary-continue"
          label={hasSession ? t("Continuer") : t("Sauvegarder mon écurie")}
          onPress={() => void next()}
        />
      </View>
    </SafeAreaView>
  );
}
