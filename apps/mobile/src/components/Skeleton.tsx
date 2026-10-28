import { useEffect, useState } from "react";
import { Animated, type DimensionValue } from "react-native";
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
