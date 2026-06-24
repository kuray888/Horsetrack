import { useEffect, useRef } from "react";
import { Animated, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { usePressScale } from "@/hooks/usePressScale";

/** Bulle flottante d'accès rapide au coach IA, affichée au-dessus des onglets. */
export function CoachBubble() {
  const { scale: pressScale, onPressIn, onPressOut } = usePressScale(0.9);
  const breath = useRef(new Animated.Value(0)).current;

  // Respiration douce en boucle pour attirer l'œil sans être agressive.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);

  const breathScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <Animated.View
      style={{
        position: "absolute",
        bottom: 100,
        right: 20,
        transform: [{ scale: Animated.multiply(pressScale, breathScale) }],
      }}
    >
      <TouchableOpacity
        onPress={() => router.push("/coach-modal")}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.85}
        className="h-14 w-14 items-center justify-center rounded-full bg-primary shadow-card"
      >
        <Text className="text-2xl">🧑‍🏫</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
