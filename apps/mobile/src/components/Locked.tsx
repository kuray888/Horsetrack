import { ReactNode } from "react";
import { Animated, View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useSubscription } from "@/subscription/store";
import { usePressScale } from "@/hooks/usePressScale";

/**
 * Gating « soft » d'un visuel premium.
 *
 * - Abonné / en essai → affiche le contenu normalement.
 * - Sinon → affiche le contenu atténué (non interactif) avec un overlay
 *   verrouillé : cadenas + message + bouton « Débloquer » qui ouvre le paywall.
 *
 * L'app reste navigable ; seul le visuel est bloqué.
 * NOTE: flou réel possible plus tard avec expo-blur ; ici on atténue via opacité.
 */
export function Locked({
  children,
  message = "Disponible avec l'abonnement",
  cta = "Débloquer",
}: {
  children: ReactNode;
  message?: string;
  cta?: string;
}) {
  const { isPremium } = useSubscription();
  const { scale, onPressIn, onPressOut } = usePressScale();

  if (isPremium) return <>{children}</>;

  return (
    <View className="relative overflow-hidden rounded-card">
      {/* Contenu réel en aperçu, atténué et non interactif */}
      <View pointerEvents="none" className="opacity-30">
        {children}
      </View>

      {/* Overlay de déverrouillage */}
      <View className="absolute inset-0 items-center justify-center gap-3 bg-surface/40 p-4">
        <Text className="text-2xl">🔒</Text>
        <Text className="text-center text-sm font-semibold text-text">{message}</Text>
        <Animated.View style={{ transform: [{ scale }] }}>
          <TouchableOpacity
            onPress={() => router.push("/paywall")}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            activeOpacity={0.85}
            className="rounded-full bg-primary px-5 py-2.5"
          >
            <Text className="text-sm font-bold text-on-primary">{cta}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}
