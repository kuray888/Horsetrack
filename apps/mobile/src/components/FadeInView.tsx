import { ReactNode, useEffect, useState } from "react";
import { Animated, Easing } from "react-native";
import { prefersReducedMotion } from "@/lib/motion";

/** Délai maximal d'apparition. Les listes échelonnent leurs éléments
 * (`delay={120 + i * 60}`) : sans plafond, le 50e souvenir du Journal
 * attendait plus de 3 s pour apparaître — l'app paraissait d'autant plus
 * lente qu'on l'utilisait. Au-delà, les éléments apparaissent ensemble (ils
 * sont de toute façon hors de l'écran). */
export const MAX_FADE_DELAY_MS = 420;

/** Décélération franche : le mouvement démarre vite et se pose en douceur
 * (plus naturel que l'accélération/décélération par défaut). */
const EASE_OUT = Easing.out(Easing.cubic);

type Props = {
  delay?: number;
  children: ReactNode;
};

/**
 * Fondu + légère translation à l'apparition, via l'API `Animated` native de
 * React Native (pas `react-native-reanimated`, qui plante dans Expo Go ici).
 * « Réduire les animations » activé : contenu affiché tout de suite, sans
 * mouvement.
 */
export function FadeInView({ delay = 0, children }: Props) {
  const [reduced] = useState(prefersReducedMotion);
  const [opacity] = useState(() => new Animated.Value(reduced ? 1 : 0));
  const [translateY] = useState(() => new Animated.Value(reduced ? 0 : 12));

  const cappedDelay = Math.min(Math.max(delay, 0), MAX_FADE_DELAY_MS);

  useEffect(() => {
    if (reduced) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, delay: cappedDelay, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 320, delay: cappedDelay, easing: EASE_OUT, useNativeDriver: true }),
    ]).start();
  }, [cappedDelay, opacity, translateY, reduced]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}
