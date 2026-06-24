import { useRef } from "react";
import { Animated } from "react-native";

/**
 * Effet de pression "physique" (léger rétrécissement) à coupler avec
 * `activeOpacity` sur un `TouchableOpacity` — rend les interactions plus
 * tactiles que le simple fondu d'opacité. Même API `Animated` native que
 * FadeInView (pas reanimated, qui plante dans Expo Go ici).
 */
export function usePressScale(activeScale = 0.96) {
  const scale = useRef(new Animated.Value(1)).current;

  function onPressIn() {
    Animated.spring(scale, { toValue: activeScale, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
  }

  return { scale, onPressIn, onPressOut };
}
