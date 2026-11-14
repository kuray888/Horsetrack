import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { BackButton } from "@/components/BackButton";

/**
 * En-tête d'un écran poussé depuis la fiche cheval (Santé, Budget, Poids…) :
 * flèche retour à gauche, titre à côté, comme dans les apps iOS. Ces écrans
 * arrivent par la droite (pile) mais se fermaient par un « X » de fenêtre
 * modale, en haut à droite — le geste attendu (glisser depuis le bord
 * gauche) marchait, le bouton ne le suggérait pas.
 *
 * `right` : action secondaire facultative (bouton icône de 44 pt).
 */
export function SubScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string | null;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-1">
      <BackButton onPress={onBack} />
      <View className="flex-1 gap-1">
        <Text className="text-2xl font-display tracking-tight text-text" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text className="text-[15px] text-muted">{subtitle}</Text> : null}
      </View>
      {right ?? null}
    </View>
  );
}
