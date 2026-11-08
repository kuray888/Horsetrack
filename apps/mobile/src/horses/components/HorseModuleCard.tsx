import { Children, Fragment, type ReactNode } from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { usePressScale } from "@/hooks/usePressScale";
import { useThemeColors } from "@/theme/ThemeProvider";

const CARD = "rounded-card bg-surface p-5 shadow-card";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Carte de module pleine largeur (un résumé + un accès au module complet).
 * `value` est déjà le texte final calculé par l'appelant. */
export function HorseModuleCard({
  icon,
  iconColor,
  title,
  value,
  onPress,
}: {
  icon: IconName;
  iconColor: string;
  title: string;
  value: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity accessibilityRole="button" activeOpacity={0.85} onPress={onPress} className={`${CARD} flex-row items-center gap-3`}>
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

/** Tuile d'un module essentiel (grille 2×2 en tête de fiche) : plus grande,
 * pour que les quatre usages quotidiens ressortent du reste. */
export function HorseModuleTile({
  icon,
  iconColor,
  title,
  value,
  onPress,
  testID,
}: {
  icon: IconName;
  iconColor: string;
  title: string;
  value: string;
  onPress: () => void;
  testID?: string;
}) {
  const { scale, onPressIn, onPressOut } = usePressScale(0.97);
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${value}`}
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        testID={testID}
        className="min-h-[128px] flex-1 justify-between gap-3 rounded-card bg-surface p-4 shadow-card"
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-highlight">
          <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
        </View>
        <View className="gap-1">
          <Text className="text-base font-bold text-text">{title}</Text>
          <Text className="text-[13px] leading-4 text-muted" numberOfLines={2}>
            {value}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/** Grille 2 colonnes de tuiles. */
export function HorseModuleGrid({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <View className="gap-3">
      {rows.map((row, i) => (
        <View key={i} className="flex-row gap-3">
          {row}
          {row.length === 1 ? <View className="flex-1" /> : null}
        </View>
      ))}
    </View>
  );
}

/** Ligne compacte d'un module secondaire, dans un groupe (HorseModuleGroup). */
export function HorseModuleRow({
  icon,
  iconColor,
  title,
  value,
  onPress,
}: {
  icon: IconName;
  iconColor: string;
  title: string;
  value: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${value}`}
      activeOpacity={0.7}
      onPress={onPress}
      className="flex-row items-center gap-3 py-3"
    >
      <View className="h-8 w-8 items-center justify-center rounded-full bg-highlight">
        <MaterialCommunityIcons name={icon} size={16} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-text">{title}</Text>
        <Text className="text-[13px] text-muted" numberOfLines={1}>
          {value}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

/** Carte qui regroupe des lignes de modules, séparées par un filet. */
export function HorseModuleGroup({ title, children }: { title: string; children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View className="gap-2">
      <Text className="px-1 text-xs font-bold uppercase tracking-wide text-muted">{title}</Text>
      <View className="rounded-card bg-surface px-4 shadow-card">
        {items.map((child, i) => (
          <Fragment key={i}>
            {i > 0 ? <View className="ml-11 border-t border-border" /> : null}
            {child}
          </Fragment>
        ))}
      </View>
    </View>
  );
}
