import type { ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";

/**
 * Titre de section d'un écran (« Aujourd'hui », « À venir », « Compte ») :
 * 20 pt Bricolage, annoncé comme titre à VoiceOver, avec une action
 * facultative à droite (« Voir tout ») dans une cible de 44 pt. Quatre styles
 * coexistaient (gras système, Bricolage, petites majuscules, 13 px).
 */
export function SectionHeader({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onPress: () => void; accessibilityLabel?: string };
  /** Contenu sous le titre (ex. une précision d'une ligne). */
  children?: ReactNode;
}) {
  return (
    <View>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-title3 font-display-bold text-text" accessibilityRole="header">
          {title}
        </Text>
        {action ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={action.accessibilityLabel}
            onPress={action.onPress}
            hitSlop={12}
            className="min-h-[44px] justify-center"
          >
            <Text className="text-sm font-semibold text-link">{action.label}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/**
 * Étiquette de groupe dans une liste (« Mes chevaux », un jour du Planning,
 * « Historique ») : 13 pt, petites majuscules, atténuée.
 */
export function GroupLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Text className={`text-footnote font-bold uppercase tracking-wide text-muted ${className ?? ""}`} accessibilityRole="header">
      {children}
    </Text>
  );
}
