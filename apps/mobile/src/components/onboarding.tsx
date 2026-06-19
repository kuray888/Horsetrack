import { ReactNode } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import type { Option } from "@/onboarding/options";

/** Barre de progression fine en haut de chaque étape. */
export function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = Math.round((step / total) * 100);
  return (
    <View className="h-1.5 w-full overflow-hidden rounded-full bg-border">
      <View className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
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
        <View className="gap-2">
          <Text className="text-2xl font-extrabold tracking-tight text-text">{title}</Text>
          {subtitle ? <Text className="text-base text-muted">{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>

      <View className="px-5 pb-2 pt-3">
        <PrimaryButton label={ctaLabel} disabled={ctaDisabled} onPress={onNext} />
      </View>
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
  return (
    <TouchableOpacity
      onPress={onPress}
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
  );
}

/** Carte d'option sélectionnable (single-select). */
export function OptionCard({
  label,
  emoji,
  selected,
  onPress,
}: {
  label: string;
  emoji?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className={`flex-row items-center gap-3 rounded-card border p-4 ${
        selected ? "border-primary bg-highlight" : "border-border bg-surface"
      }`}
    >
      {emoji ? <Text className="text-xl">{emoji}</Text> : null}
      <Text
        className={`flex-1 text-base font-semibold ${selected ? "text-primary" : "text-text"}`}
      >
        {label}
      </Text>
      {selected ? <Text className="text-lg font-bold text-primary">✓</Text> : null}
    </TouchableOpacity>
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
          emoji={opt.emoji}
          selected={value === opt.value}
          onPress={() => onChange(opt.value)}
        />
      ))}
    </View>
  );
}

/** Puces multi-select (points forts / faibles). */
export function MultiSelectChips({
  options,
  values,
  onToggle,
}: {
  options: string[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => {
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
  );
}
