import { useState } from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { OnboardingShell } from "@/components/onboarding";
import { FadeInView } from "@/components/FadeInView";
import { usePressScale } from "@/hooks/usePressScale";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useOnboarding } from "@/onboarding/store";
import { TOTAL_STEPS } from "@/onboarding/options";
import {
  CARE_DATE_PRESETS,
  FIRST_CARE_TYPES,
  FIRST_SESSION_ACTIVITIES,
  SESSION_DATE_PRESETS,
  dayKey,
  defaultSessionActivity,
  presetDate,
  type DatePreset,
  type FirstCareType,
  type FirstSessionActivity,
} from "@/onboarding/firstAction";
import { APPT_META } from "@/agenda/meta";
import { ACTIVITY_META } from "@/agenda/store";
import { ensureNotificationPermission } from "@/lib/notifications";
import { track } from "@/lib/analytics";
import { hapticSelection } from "@/lib/haptics";
import { animateNextLayout } from "@/lib/motion";
import { t } from "@/i18n";

type Kind = "care" | "session";
type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const PRESET_LABEL: Record<DatePreset, string> = {
  today: t("Aujourd'hui"),
  tomorrow: t("Demain"),
  in_2_days: t("Après-demain"),
  in_1_week: t("Dans 1 semaine"),
  in_2_weeks: t("Dans 2 semaines"),
  in_1_month: t("Dans 1 mois"),
  in_2_months: t("Dans 2 mois"),
};

/** Grande carte de choix (soin ou séance), avec une ligne d'explication. */
function KindCard({
  icon,
  title,
  hint,
  selected,
  onPress,
  testID,
}: {
  icon: IconName;
  title: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  const colors = useThemeColors();
  const { scale, onPressIn, onPressOut } = usePressScale();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.85}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${title}, ${hint}`}
        testID={testID}
        className={`flex-row items-center gap-4 rounded-card border-2 p-4 ${
          selected ? "border-primary bg-highlight" : "border-border bg-surface"
        }`}
      >
        <View className="h-12 w-12 items-center justify-center rounded-full bg-background">
          <MaterialCommunityIcons name={icon} size={24} color={colors.primary} />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-[17px] font-bold text-text">{title}</Text>
          <Text className="text-[13px] leading-4 text-muted">{hint}</Text>
        </View>
        <MaterialCommunityIcons
          name={selected ? "radiobox-marked" : "radiobox-blank"}
          size={24}
          color={selected ? colors.primary : colors.textMuted}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

/** Puces à choix unique (type de soin, date…). */
function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
  labelOf,
  testIDPrefix,
}: {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  labelOf: (v: T) => string;
  testIDPrefix: string;
}) {
  return (
    <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text className="text-[13px] font-semibold uppercase tracking-wide text-muted">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => {
                if (!selected) hapticSelection();
                onChange(opt);
              }}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              testID={`${testIDPrefix}-${opt}`}
              className={`min-h-[44px] justify-center rounded-full border px-4 py-2 ${
                selected ? "border-primary bg-primary" : "border-border bg-surface"
              }`}
            >
              <Text className={`text-[15px] font-semibold ${selected ? "text-on-primary" : "text-text"}`}>{labelOf(opt)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Première action, juste après le cheval : noter son prochain soin (le rappel
 * offert du palier gratuit) ou planifier sa prochaine séance. Quelques
 * touchers, puis l'écran de récompense (summary.tsx). Rien n'est créé ici :
 * le choix part dans le brouillon et devient un vrai rendez-vous ou une vraie
 * séance à la fin du parcours (cf. (onboarding)/paywall.tsx). Étape
 * facultative : « Plus tard » mène au même écran, sans rien noter.
 */
export default function FirstAction() {
  const { rider, horses, firstAction, setFirstAction } = useOnboarding();
  const primary = horses.find((h) => h.isPrimary) ?? horses[0];
  const name = primary?.name.trim() || t("ton cheval");

  const [kind, setKind] = useState<Kind | null>(firstAction?.kind ?? null);
  const [careType, setCareType] = useState<FirstCareType | null>(firstAction?.kind === "care" ? firstAction.careType : null);
  const [careDate, setCareDate] = useState<DatePreset | null>(null);
  const [activity, setActivity] = useState<FirstSessionActivity>(
    firstAction?.kind === "session" ? firstAction.activity : defaultSessionActivity(rider.mainDiscipline)
  );
  const [sessionDate, setSessionDate] = useState<DatePreset>("tomorrow");
  const [saving, setSaving] = useState(false);

  const ready = kind === "care" ? !!careType && !!careDate : kind === "session";

  function chooseKind(k: Kind) {
    if (k !== kind) {
      hapticSelection();
      animateNextLayout();
    }
    setKind(k);
  }

  async function save() {
    if (!ready || saving) return;
    setSaving(true);
    try {
      if (kind === "care" && careType && careDate) {
        // Demande de notification EN CONTEXTE : l'écran vient de dire « on te
        // prévient la veille ». Un refus n'empêche pas de noter le soin.
        const reminder = await ensureNotificationPermission().catch(() => false);
        setFirstAction({ kind: "care", careType, day: dayKey(presetDate(careDate)), reminder });
        track("onboarding_first_action_saved", { kind: "care", type: careType, preset: careDate, reminder });
      } else if (kind === "session") {
        setFirstAction({ kind: "session", activity, day: dayKey(presetDate(sessionDate)) });
        track("onboarding_first_action_saved", { kind: "session", type: activity, preset: sessionDate });
      }
      router.push("/(onboarding)/summary");
    } finally {
      setSaving(false);
    }
  }

  function skip() {
    setFirstAction(null);
    track("onboarding_first_action_skipped", {});
    router.push("/(onboarding)/summary");
  }

  return (
    <OnboardingShell
      stepId="first_action"
      step={3}
      total={TOTAL_STEPS}
      title={t("Que veux-tu noter pour {name} ?", { name })}
      subtitle={t("Un premier rendez-vous, et HorseTrack s'occupe du reste.")}
      ctaLabel={
        saving
          ? t("Un instant…")
          : kind === "care"
            ? t("Enregistrer et me prévenir")
            : kind === "session"
              ? t("Enregistrer la séance")
              : t("Continuer")
      }
      ctaDisabled={!ready || saving}
      onNext={() => void save()}
      ctaTestID="first-action-save"
      secondaryLabel={t("Plus tard")}
      onSecondary={skip}
    >
      <View className="gap-3" accessibilityRole="radiogroup">
        <KindCard
          icon="needle"
          title={t("Son prochain soin")}
          hint={t("Maréchal, vaccin, véto… on te prévient la veille.")}
          selected={kind === "care"}
          onPress={() => chooseKind("care")}
          testID="first-action-care"
        />
        {kind === "care" ? (
          <FadeInView>
            <View className="gap-4 px-1 pb-2">
              <Chips
                label={t("Quel soin ?")}
                options={FIRST_CARE_TYPES}
                value={careType}
                onChange={setCareType}
                labelOf={(v) => APPT_META[v].label}
                testIDPrefix="first-care"
              />
              <Chips
                label={t("Quand ?")}
                options={CARE_DATE_PRESETS}
                value={careDate}
                onChange={setCareDate}
                labelOf={(v) => PRESET_LABEL[v]}
                testIDPrefix="first-care-date"
              />
            </View>
          </FadeInView>
        ) : null}

        <KindCard
          icon="horse-variant"
          title={t("Sa prochaine séance")}
          hint={t("Planifie ta prochaine sortie avec {name}.", { name })}
          selected={kind === "session"}
          onPress={() => chooseKind("session")}
          testID="first-action-session"
        />
        {kind === "session" ? (
          <FadeInView>
            <View className="gap-4 px-1 pb-2">
              <Chips
                label={t("Quelle séance ?")}
                options={FIRST_SESSION_ACTIVITIES}
                value={activity}
                onChange={setActivity}
                labelOf={(v) => ACTIVITY_META[v].label}
                testIDPrefix="first-session"
              />
              <Chips
                label={t("Quand ?")}
                options={SESSION_DATE_PRESETS}
                value={sessionDate}
                onChange={setSessionDate}
                labelOf={(v) => PRESET_LABEL[v]}
                testIDPrefix="first-session-date"
              />
            </View>
          </FadeInView>
        ) : null}
      </View>
    </OnboardingShell>
  );
}
