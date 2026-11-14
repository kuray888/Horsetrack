import type { ReactNode } from "react";
import { Animated, TouchableOpacity, View, type AccessibilityRole, type AccessibilityState } from "react-native";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { usePressScale } from "@/hooks/usePressScale";
import { hapticSelection, hapticTap } from "@/lib/haptics";
import { prefersReducedMotion } from "@/lib/motion";
import { useThemeColors } from "@/theme/ThemeProvider";
import { t } from "@/i18n";

/**
 * Bouton icône : la surface touchable fait toujours 44 × 44 pt (minimum
 * iOS), quelle que soit la taille du dessin à l'intérieur. Remplace les
 * cercles de 28-32 pt agrandis par `hitSlop` : deux voisins (lecture et
 * case à cocher) se chevauchaient, et un gant touchait l'un pour l'autre.
 *
 * Pression : léger rétrécissement (sauf « Réduire les animations ») et
 * retour haptique — `selection` pour un choix (cocher), `tap` pour une
 * action.
 */
export function IconButton({
  onPress,
  accessibilityLabel,
  accessibilityRole = "button",
  accessibilityState,
  haptic = "tap",
  disabled,
  testID,
  children,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  haptic?: "tap" | "selection" | "none";
  disabled?: boolean;
  testID?: string;
  children: ReactNode;
}) {
  const { scale, onPressIn, onPressOut } = usePressScale(0.9);
  const animate = !prefersReducedMotion();
  return (
    <TouchableOpacity
      onPress={() => {
        if (haptic === "tap") hapticTap();
        else if (haptic === "selection") hapticSelection();
        onPress();
      }}
      onPressIn={animate ? onPressIn : undefined}
      onPressOut={animate ? onPressOut : undefined}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      testID={testID}
      className="h-11 w-11 items-center justify-center"
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </TouchableOpacity>
  );
}

/** Case ronde « c'est fait » (séance, tâche, participation reçue) : le même
 * geste partout dans l'app, dessin de 28 pt dans une cible de 44 pt. */
export function DoneCheckbox({
  checked,
  onToggle,
  accessibilityLabel,
  disabled,
}: {
  checked: boolean;
  onToggle: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <IconButton
      onPress={onToggle}
      // Le retour haptique vient de l'action elle-même (hapticSuccess quand
      // une séance passe à « faite ») : pas de double vibration ici.
      haptic="none"
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
    >
      <View
        className={`h-7 w-7 items-center justify-center rounded-full ${checked ? "bg-success" : "border-2 border-border"}`}
      >
        {checked ? <MaterialCommunityIcons name="check" size={17} color={colors.textOnStatus} /> : null}
      </View>
    </IconButton>
  );
}

/** Libellé VoiceOver par défaut d'une case de séance. */
export function sessionCheckboxLabel(done: boolean): string {
  return done ? t("Séance faite, marquer à faire") : t("Marquer la séance faite");
}
