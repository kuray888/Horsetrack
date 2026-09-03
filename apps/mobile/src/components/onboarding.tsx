import { ReactNode, useEffect, useRef, useState } from "react";
import { Animated, View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { usePressScale } from "@/hooks/usePressScale";
import { FadeInView } from "@/components/FadeInView";
import { PickerOverlaySlot } from "@/components/PickerOverlay";
import { colors } from "@/theme/colors";
import type { Option } from "@/onboarding/options";

/** Barre de progression fine en haut de chaque étape — le remplissage est
 * animé (au lieu de sauter directement à la valeur cible) plutôt que statique,
 * pour accompagner la progression dans l'onboarding comme dans le programme
 * (cf. Planning, qui réutilise ce composant pour le taux de complétion). */
export function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((step / total) * 100))) : 0;
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(width, { toValue: pct, duration: 400, useNativeDriver: false }).start();
  }, [pct, width]);

  return (
    <View className="h-1.5 w-full overflow-hidden rounded-full bg-border">
      <Animated.View
        className="h-full rounded-full bg-primary"
        style={{ width: width.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }) }}
      />
    </View>
  );
}

/**
 * Coque standard d'un écran d'onboarding : safe-area, bouton retour, progression,
 * titre/sous-titre, contenu défilant, et un CTA principal collé en bas.
 */
export function OnboardingShell({
  step,
  total,
  title,
  subtitle,
  children,
  ctaLabel = "Continuer",
  ctaDisabled = false,
  onNext,
  canGoBack = true,
}: {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  ctaLabel?: string;
  ctaDisabled?: boolean;
  onNext: () => void;
  canGoBack?: boolean;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row items-center gap-3 px-5 pt-2">
        {canGoBack && router.canGoBack() ? (
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text className="text-2xl text-muted">‹</Text>
          </TouchableOpacity>
        ) : null}
        <View className="flex-1">
          <ProgressBar step={step} total={total} />
        </View>
      </View>

      <ScrollView
        contentContainerClassName="px-5 pt-6 pb-4 gap-5"
        showsVerticalScrollIndicator={false}
      >
        <FadeInView>
          <View className="gap-2">
            <Text className="text-2xl font-extrabold tracking-tight text-text">{title}</Text>
            {subtitle ? <Text className="text-base text-muted">{subtitle}</Text> : null}
          </View>
        </FadeInView>
        <FadeInView delay={80}>
          <View className="gap-5">{children}</View>
        </FadeInView>
      </ScrollView>

      <View className="px-5 pb-2 pt-3">
        <PrimaryButton label={ctaLabel} disabled={ctaDisabled} onPress={onNext} />
      </View>
      <PickerOverlaySlot />
    </SafeAreaView>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { scale, onPressIn, onPressOut } = usePressScale();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        activeOpacity={0.85}
        className={`items-center rounded-card p-4 ${disabled ? "bg-border" : "bg-primary"}`}
      >
        <Text
          className={`text-base font-bold ${disabled ? "text-muted" : "text-on-primary"}`}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

/** Carte d'option sélectionnable (single-select). */
export function OptionCard({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon?: { name: keyof typeof MaterialCommunityIcons.glyphMap; color: string };
  selected: boolean;
  onPress: () => void;
}) {
  const { scale, onPressIn, onPressOut } = usePressScale();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.8}
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        className={`flex-row items-center gap-3 rounded-card border p-4 ${
          selected ? "border-primary bg-highlight" : "border-border bg-surface"
        }`}
      >
        {icon ? (
          <View className="h-9 w-9 items-center justify-center rounded-full bg-background" importantForAccessibility="no">
            <MaterialCommunityIcons name={icon.name} size={18} color={icon.color} accessibilityElementsHidden />
          </View>
        ) : null}
        <Text
          className={`flex-1 text-base font-semibold ${selected ? "text-primary" : "text-text"}`}
        >
          {label}
        </Text>
        {selected ? <MaterialCommunityIcons name="check-circle" size={20} color={colors.primary} /> : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

/** Liste de cartes single-select à partir d'une liste d'options typées. */
export function SingleSelect<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <View className="gap-3">
      {options.map((opt) => (
        <OptionCard
          key={opt.value}
          label={opt.label}
          icon={opt.icon}
          selected={value === opt.value}
          onPress={() => onChange(opt.value)}
        />
      ))}
    </View>
  );
}

/**
 * Puces multi-select (points forts / faibles, tempérament, activités de
 * repos...). `allowCustom` ajoute un champ libre pour les tags hors liste
 * suggérée — ils s'affichent ensuite comme des puces normales (retaper
 * dessus les retire, comme pour une puce de la liste qu'on désélectionne).
 */
export function MultiSelectChips({
  options,
  values,
  onToggle,
  allowCustom = false,
}: {
  options: string[];
  values: string[];
  onToggle: (value: string) => void;
  allowCustom?: boolean;
}) {
  const [customInput, setCustomInput] = useState("");
  const customValues = values.filter((v) => !options.includes(v));

  function addCustom() {
    const trimmed = customInput.trim();
    if (!trimmed || values.includes(trimmed)) return;
    onToggle(trimmed);
    setCustomInput("");
  }

  return (
    <View className="gap-2.5">
      <View className="flex-row flex-wrap gap-2">
        {[...options, ...customValues].map((opt) => {
          const selected = values.includes(opt);
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => onToggle(opt)}
              activeOpacity={0.8}
              className={`rounded-full border px-4 py-2.5 ${
                selected ? "border-primary bg-highlight" : "border-border bg-surface"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${selected ? "text-primary" : "text-text"}`}
              >
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {allowCustom ? (
        <View className="flex-row items-center gap-2">
          <TextInput
            className="flex-1 rounded-full border border-border bg-surface px-4 py-2.5 text-sm text-text"
            placeholder="Autre (préciser)…"
            value={customInput}
            onChangeText={setCustomInput}
            onSubmitEditing={addCustom}
            returnKeyType="done"
          />
          <TouchableOpacity
            onPress={addCustom}
            disabled={!customInput.trim()}
            activeOpacity={0.8}
            className={`h-9 w-9 items-center justify-center rounded-full ${
              customInput.trim() ? "bg-primary" : "bg-border"
            }`}
          >
            <Text className={`text-base font-bold ${customInput.trim() ? "text-on-primary" : "text-muted"}`}>
              +
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
