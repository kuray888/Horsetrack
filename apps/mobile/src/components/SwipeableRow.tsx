import { useRef, type ComponentProps, type ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { hapticTap } from "@/lib/haptics";

export type SwipeAction = {
  label: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  /** Fond du panneau révélé (couleur du thème : succès, danger…). */
  color: string;
  onPress: () => void;
};

const PANEL_WIDTH = 92;

/**
 * Ligne balayable, façon Mail ou Rappels :
 *
 * - balayer vers la droite déclenche l'action de tête dès que le panneau est
 *   ouvert (ex. « Fait »), puis la carte se referme ;
 * - balayer vers la gauche révèle l'action de queue (ex. « Supprimer »), qui
 *   ne s'exécute qu'au toucher : une suppression ne part jamais d'un geste
 *   seul, et l'action appelée garde sa propre confirmation.
 *
 * Raccourci uniquement : chaque action reste disponible par les boutons de
 * la carte dépliée, y compris pour VoiceOver qui ne balaie pas.
 */
export function SwipeableRow({
  children,
  leading,
  trailing,
}: {
  children: ReactNode;
  leading?: SwipeAction | null;
  trailing?: SwipeAction | null;
}) {
  const ref = useRef<SwipeableMethods>(null);

  if (!leading && !trailing) return <>{children}</>;

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1.6}
      leftThreshold={PANEL_WIDTH * 0.8}
      rightThreshold={PANEL_WIDTH * 0.45}
      overshootLeft={false}
      overshootRight={false}
      // Les cartes ont une ombre : le conteneur, par défaut, la rogne.
      containerStyle={{ overflow: "visible" }}
      renderLeftActions={
        leading ? (progress) => <ActionPanel action={leading} progress={progress} side="leading" /> : undefined
      }
      renderRightActions={
        trailing
          ? (progress) => (
              <ActionPanel
                action={trailing}
                progress={progress}
                side="trailing"
                onPress={() => {
                  ref.current?.close();
                  hapticTap();
                  trailing.onPress();
                }}
              />
            )
          : undefined
      }
      onSwipeableOpen={(direction) => {
        // « right » : le contenu est parti vers la droite, le panneau de
        // tête est entièrement révélé.
        // Pas de retour haptique ici : l'action de tête a déjà le sien (cf.
        // useSessionDonePrompt), deux vibrations se marcheraient dessus.
        if (direction === "right" && leading) {
          leading.onPress();
          ref.current?.close();
        }
      }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

function ActionPanel({
  action,
  progress,
  side,
  onPress,
}: {
  action: SwipeAction;
  progress: SharedValue<number>;
  side: "leading" | "trailing";
  onPress?: () => void;
}) {
  // L'icône grossit à mesure que le panneau s'ouvre : on sent le seuil
  // approcher avant de le franchir.
  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0.6, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.6, 1], Extrapolation.CLAMP) }],
  }));

  const content = (
    <Animated.View style={[{ alignItems: "center", gap: 4 }, contentStyle]}>
      <MaterialCommunityIcons name={action.icon} size={22} color="#ffffff" />
      <Text className="text-xs font-bold text-white">{action.label}</Text>
    </Animated.View>
  );

  return (
    <View
      className={`justify-center rounded-card ${side === "leading" ? "mr-2" : "ml-2"}`}
      style={{ width: PANEL_WIDTH, backgroundColor: action.color }}
    >
      {onPress ? (
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          className="flex-1 items-center justify-center"
        >
          {content}
        </TouchableOpacity>
      ) : (
        <View className="flex-1 items-center justify-center">{content}</View>
      )}
    </View>
  );
}
