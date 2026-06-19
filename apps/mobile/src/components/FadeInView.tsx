import { ReactNode, useEffect, useRef } from "react";
import { Animated } from "react-native";

type Props = {
  delay?: number;
  children: ReactNode;
};

/**
 * Fondu + légère translation à l'apparition, via l'API `Animated` native de
 * React Native (pas `react-native-reanimated`, qui plante dans Expo Go ici).
 */
export function FadeInView({ delay = 0, children }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay, useNativeDriver: true }),
    ]).start();
  }, [delay, opacity, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}
