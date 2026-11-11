import { useEffect, useState } from "react";
import { Animated, View, type DimensionValue } from "react-native";
import { t } from "@/i18n";
import { prefersReducedMotion } from "@/lib/motion";
import { useThemeColors } from "@/theme/ThemeProvider";

/**
 * Bloc de chargement : occupe la place du contenu attendu (un prix, une
 * ligne de texte) au lieu d'un texte provisoire qui pourrait être faux.
 * Pulsation douce, figée si « Réduire les animations » est activé.
 */
export function Skeleton({
  width,
  height = 14,
  radius = 6,
}: {
  width: DimensionValue;
  height?: number;
  radius?: number;
}) {
  const colors = useThemeColors();
  const [opacity] = useState(() => new Animated.Value(0.55));

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ width, height, borderRadius: radius, opacity, backgroundColor: colors.border }}
    />
  );
}

/**
 * Liste en cours de chargement (fils de commentaires…) : la forme des lignes
 * attendues plutôt qu'une roue seule. Annoncée une fois à VoiceOver.
 */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View className="gap-4" accessible accessibilityLabel={t("Chargement…")} accessibilityRole="progressbar">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} className="flex-row items-start gap-3">
          <Skeleton width={32} height={32} radius={16} />
          <View className="flex-1 gap-2">
            <Skeleton width="40%" height={12} />
            <Skeleton width={i % 2 === 0 ? "90%" : "70%"} />
          </View>
        </View>
      ))}
    </View>
  );
}
