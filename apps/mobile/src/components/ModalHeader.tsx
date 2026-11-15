import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { IconButton } from "@/components/IconButton";
import { useThemeColors } from "@/theme/ThemeProvider";
import { t } from "@/i18n";

/**
 * En-tête commun des fenêtres (modales) : titre à gauche, croix de 24 pt dans
 * une cible de 44 pt à droite. Chaque modale refaisait le sien, avec une
 * croix de 22 ou 24 pt et un titre présent ou non.
 */
export function ModalHeader({
  title,
  subtitle,
  onClose,
  right,
}: {
  title: string;
  subtitle?: string | null;
  /** Par défaut `router.back()` (la garde de saisie s'applique, cf. useDiscardGuard). */
  onClose?: () => void;
  /** Action facultative placée avant la croix. */
  right?: ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <View className="flex-row items-center gap-2">
      <View className="flex-1 gap-1">
        <Text className="text-2xl font-display tracking-tight text-text" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text className="text-[15px] text-muted">{subtitle}</Text> : null}
      </View>
      {right ?? null}
      {/* Décalée vers le bord : la croix reste alignée sur la marge du contenu. */}
      <View className="-mr-3">
        <IconButton onPress={onClose ?? (() => router.back())} accessibilityLabel={t("Fermer")}>
          <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} accessibilityElementsHidden />
        </IconButton>
      </View>
    </View>
  );
}
