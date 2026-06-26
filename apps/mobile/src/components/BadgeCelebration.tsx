import { useEffect, useRef } from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";
import { useProgress } from "@/progress/store";

/**
 * Overlay plein écran affiché dès qu'un nouveau badge est débloqué, quel que
 * soit l'onglet. View absolue, pas le `<Modal>` natif de RN : sur ce projet,
 * sous Expo Go avec la New Architecture, `<Modal>` peut rester accroché au
 * premier plan sans jamais s'afficher, ce qui bloque tout l'input tactile de
 * l'appli (même précédent que glossary/GlossaryProvider.tsx). Monté une seule
 * fois à la racine (cf. _layout.tsx), au-dessus du Stack — contrairement à
 * GlossaryPopup, pas besoin de le remonter par écran : une célébration de
 * badge ne survient jamais alors qu'un autre overlay plein écran est déjà ouvert.
 */
export function BadgeCelebration() {
  const { celebrationBadge, dismissCelebration } = useProgress();
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!celebrationBadge) return;
    scale.setValue(0.8);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [celebrationBadge, scale, opacity]);

  if (!celebrationBadge) return null;

  return (
    <View className="absolute inset-0 z-50 items-center justify-center bg-black/50 px-8">
      <Animated.View
        style={{ transform: [{ scale }], opacity }}
        className="w-full items-center gap-4 rounded-card bg-surface p-7 shadow-card"
      >
        <Text className="text-xs font-bold uppercase tracking-wide text-accent">Succès débloqué</Text>
        <View className="h-24 w-24 items-center justify-center rounded-full bg-highlight">
          <Text className="text-5xl">{celebrationBadge.icon}</Text>
        </View>
        <View className="items-center gap-1">
          <Text className="text-center text-xl font-extrabold text-text">{celebrationBadge.label}</Text>
          <Text className="text-center text-sm text-muted">{celebrationBadge.description}</Text>
        </View>
        <TouchableOpacity
          onPress={dismissCelebration}
          activeOpacity={0.85}
          className="w-full items-center rounded-card bg-primary p-4"
        >
          <Text className="text-base font-bold text-on-primary">Continuer</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
