import { Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { useThemeColors } from "@/theme/ThemeProvider";
import { animateNextLayout } from "@/lib/motion";
import { hapticTap } from "@/lib/haptics";
import { t } from "@/i18n";

/**
 * Titre d'onglet avec, à droite, le bouton « + » de l'écran.
 *
 * Remplace les grands cadres « + Ajouter » en pointillés qui occupaient le
 * haut du Planning et du Journal : l'ajout reste à un toucher, à la place où
 * les apps iOS le mettent (Rappels, Calendrier), et la liste remonte d'autant.
 * Sans `onAdd` (formulaire déjà ouvert), le bouton disparaît : un second
 * ajout ne doit pas s'empiler sur celui en cours.
 */
export function ScreenTitle({
  title,
  subtitle,
  onAdd,
  addLabel,
}: {
  title: string;
  subtitle?: string | null;
  onAdd?: () => void;
  /** Annoncé par VoiceOver, ex. « Ajouter au planning ». */
  addLabel?: string;
}) {
  const colors = useThemeColors();
  return (
    <View className="flex-row items-start gap-3">
      <View className="flex-1 gap-1">
        <Text className="text-3xl font-display tracking-tight text-text" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text className="text-base text-muted">{subtitle}</Text> : null}
      </View>
      {onAdd ? (
        <TouchableOpacity
          onPress={() => {
            animateNextLayout();
            hapticTap();
            onAdd();
          }}
          activeOpacity={0.8}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={addLabel ?? t("Ajouter")}
          className="mt-1 h-11 w-11 items-center justify-center rounded-full bg-primary shadow-card"
        >
          <MaterialCommunityIcons name="plus" size={24} color={colors.textOnPrimary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
