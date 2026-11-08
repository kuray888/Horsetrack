import { Text, View } from "react-native";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { useThemeColors } from "@/theme/ThemeProvider";
import { t } from "@/i18n";

/** À la place du bouton « Enregistrer » d'une fiche qu'on consulte sans
 * pouvoir la modifier (cheval partagé, cf. lib/permissions.ts). */
export function ReadOnlyNote({ text = t("Seuls le propriétaire et le gérant peuvent modifier cette fiche.") }: { text?: string }) {
  const colors = useThemeColors();
  return (
    <View className="flex-row items-center justify-center gap-2" accessibilityRole="text">
      <MaterialCommunityIcons name="lock-outline" size={15} color={colors.textMuted} />
      <Text className="text-sm text-muted">{text}</Text>
    </View>
  );
}
