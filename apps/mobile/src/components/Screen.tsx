import { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView, Edge } from "react-native-safe-area-context";

type Props = {
  children: ReactNode;
  /** Active le défilement vertical (par défaut true). Mets false pour un écran fixe. */
  scroll?: boolean;
  edges?: Edge[];
  /** Classes Tailwind ajoutées au conteneur de contenu. */
  className?: string;
};

/**
 * Conteneur d'écran standard : fond de page + safe area + padding/gap cohérents.
 * Encapsule la logique SafeAreaView + ScrollView ; le style passe par Tailwind.
 */
export function Screen({ children, scroll = true, edges = ["top"], className }: Props) {
  const content = `p-5 gap-4 ${className ?? ""}`;
  return (
    <SafeAreaView className="flex-1 bg-background" edges={edges}>
      {scroll ? (
        <ScrollView contentContainerClassName={content} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View className={`flex-1 ${content}`}>{children}</View>
      )}
    </SafeAreaView>
  );
}
