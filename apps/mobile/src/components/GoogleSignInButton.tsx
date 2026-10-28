import { Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { useThemeColors } from "@/theme/ThemeProvider";
import { t } from "@/i18n";

/** Bouton « Continuer avec Google » (cf. lib/googleAuth.ts). */
export function GoogleSignInButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.85}
      className="h-12 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-surface"
      style={{ opacity: disabled ? 0.6 : 1 }}
    >
      <MaterialCommunityIcons name="google" size={20} color={colors.text} />
      <Text className="text-base font-semibold text-text">{t("Continuer avec Google")}</Text>
    </TouchableOpacity>
  );
}
