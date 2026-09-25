import { ReactNode } from "react";
import { Animated, View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSubscription } from "@/subscription/store";
import { openPaywall, useTrialConfirmed } from "@/subscription/paywall";
import type { PaywallPlacement } from "@/subscription/paywallLogic";
import { usePressScale } from "@/hooks/usePressScale";
import { useThemeColors } from "@/theme/ThemeProvider";

/**
 * Gating « soft » d'un visuel premium.
 *
 * - Abonné / en essai → affiche le contenu normalement.
 * - Sinon → affiche le contenu atténué (non interactif) avec un overlay
 *   verrouillé : cadenas + message + bouton qui ouvre le paywall dans le
 *   contexte de cette fonction (`placement`, cf. subscription/paywallLogic).
 *
 * Le message décrit ce que la fonction APPORTE (« Reçois une notification
 * avant le rendez-vous »), pas ce qui est interdit. Le bouton ne promet
 * « Essayer gratuitement » que si l'essai est confirmé par le store pour ce
 * compte — sinon « Découvrir Premium ».
 *
 * L'app reste navigable ; seul le visuel est bloqué.
 * NOTE: flou réel possible plus tard avec expo-blur ; ici on atténue via opacité.
 */
export function Locked({
  children,
  message,
  placement,
  feature,
  horseId,
}: {
  children: ReactNode;
  message: string;
  placement: PaywallPlacement;
  /** Identifiant stable de la fonction verrouillée, pour l'analytics. */
  feature: string;
  /** Cheval concerné, cité par le paywall quand c'est pertinent. */
  horseId?: string;
}) {
  const { isActiveOrTrialing } = useSubscription();
  const trialConfirmed = useTrialConfirmed();
  const colors = useThemeColors();
  const { scale, onPressIn, onPressOut } = usePressScale();
  const unlocked = isActiveOrTrialing;

  if (unlocked) return <>{children}</>;

  return (
    <View className="relative overflow-hidden rounded-card">
      {/* Contenu réel en aperçu, atténué et non interactif */}
      <View pointerEvents="none" className="opacity-30">
        {children}
      </View>

      {/* Overlay de déverrouillage */}
      <View className="absolute inset-0 items-center justify-center gap-3 bg-surface/40 p-4">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-surface">
          <MaterialCommunityIcons name="lock-outline" size={20} color={colors.primary} />
        </View>
        <Text className="text-center text-sm font-semibold text-text">{message}</Text>
        <Animated.View style={{ transform: [{ scale }] }}>
          <TouchableOpacity
            onPress={() => openPaywall(placement, { feature, horseId })}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            activeOpacity={0.85}
            className="rounded-full bg-primary px-5 py-2.5"
          >
            <Text className="text-sm font-bold text-on-primary">
              {trialConfirmed ? "Essayer gratuitement" : "Découvrir Premium"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}
