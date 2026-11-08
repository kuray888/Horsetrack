import { ReactElement, ReactNode, Ref } from "react";
import { RefreshControlProps, ScrollView, View } from "react-native";
import { SafeAreaView, Edge } from "react-native-safe-area-context";

type Props = {
  children: ReactNode;
  /** Active le défilement vertical (par défaut true). Mets false pour un écran fixe. */
  scroll?: boolean;
  edges?: Edge[];
  /** Classes Tailwind ajoutées au conteneur de contenu. */
  className?: string;
  /** Élément <RefreshControl> pour le tirer-pour-rafraîchir — sans effet si `scroll` est false. */
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Accès au ScrollView, pour faire défiler vers un élément (ex. un formulaire ouvert plus bas). */
  scrollRef?: Ref<ScrollView>;
  /** En-tête FIXE au-dessus du contenu qui défile (titre, bouton Fermer) :
   * toujours accessible, même tout en bas d'une longue liste. */
  header?: ReactNode;
};

/**
 * Conteneur d'écran standard : fond de page + safe area + padding/gap cohérents.
 * Encapsule la logique SafeAreaView + ScrollView ; le style passe par Tailwind.
 */
export function Screen({ children, scroll = true, edges = ["top"], className, refreshControl, scrollRef, header }: Props) {
  const content = `p-5 gap-4 ${header ? "pt-3" : ""} ${className ?? ""}`;
  return (
    <SafeAreaView className="flex-1 bg-background" edges={edges}>
      {header ? <View className="border-b border-border px-5 pb-3 pt-2">{header}</View> : null}
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          contentContainerClassName={content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View className={`flex-1 ${content}`}>{children}</View>
      )}
    </SafeAreaView>
  );
}
