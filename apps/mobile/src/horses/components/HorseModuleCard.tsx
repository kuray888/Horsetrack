import { Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeColors } from "@/theme/ThemeProvider";

const CARD = "rounded-card bg-surface p-5 shadow-card";

/** Carte de module du Horse Hub (Santé/Entraînement/Concours/Journal/
 * Budget/Documents) — un résumé + un accès au module complet, réutilisée
 * telle quelle pour les 6 (cf. plan Phase 3 Étape 2). Ne connaît rien des
 * données propres à chaque module : `value` est déjà le texte final calculé
 * par l'appelant. */
export function HorseModuleCard({
  icon,
  iconColor,
  title,
  value,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor: string;
  title: string;
  value: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} className={`${CARD} flex-row items-center gap-3`}>
      <View className="h-11 w-11 items-center justify-center rounded-full bg-highlight">
        <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-bold text-text">{title}</Text>
        <Text className="text-sm text-muted">{value}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );
}
