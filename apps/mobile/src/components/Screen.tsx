import { ReactElement, ReactNode, Ref } from "react";
import { RefreshControlProps, ScrollView, View } from "react-native";
import { SafeAreaView, Edge, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoider } from "@/components/KeyboardAvoider";

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
  /** Barre d'actions FIXE sous le contenu (Démarrer, Pause/Terminer) : reste
   * sous le pouce, au-dessus de la barre du geste d'accueil, sans défiler. */
  footer?: ReactNode;
};

/**
 * Conteneur d'écran standard : fond de page + safe area + padding/gap cohérents.
 * Encapsule la logique SafeAreaView + ScrollView ; le style passe par Tailwind.
 */
export function Screen({ children, scroll = true, edges = ["top"], className, refreshControl, scrollRef, header, footer }: Props) {
  const insets = useSafeAreaInsets();
  const content = `p-5 gap-4 ${header ? "pt-3" : ""} ${className ?? ""}`;
  // Sous la barre d'onglets native d'iOS, l'écran s'étend jusqu'en bas et la
  // zone de sécurité du bas inclut la barre elle-même (cf. app/(tabs)/_layout) :
  // sans cette marge, la dernière carte (ex. le dernier événement passé du
  // Planning) restait coincée DERRIÈRE la barre, impossible à faire remonter.
  // Rien à ajouter quand le conteneur gère déjà le bas (edges "bottom") ou
  // qu'une barre fixe (footer) occupe cet espace.
  const bottomInset = edges.includes("bottom") || footer ? 0 : insets.bottom;
  return (
    <SafeAreaView className="flex-1 bg-background" edges={edges}>
      {header ? <View className="border-b border-border px-5 pb-3 pt-2">{header}</View> : null}
      <Body withFooter={!!footer}>
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          contentContainerClassName={content}
          contentContainerStyle={bottomInset > 0 ? { paddingBottom: 20 + bottomInset } : undefined}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // iOS décale le contenu quand le clavier s'ouvre : les champs du bas
          // (formulaires dépliés dans la page) restent visibles au-dessus.
          // Avec une barre fixe en bas, c'est KeyboardAvoider qui remonte le
          // tout (sinon le décalage serait compté deux fois).
          automaticallyAdjustKeyboardInsets={!footer}
          keyboardDismissMode="interactive"
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View className={`flex-1 ${content}`}>{children}</View>
      )}
      {footer ? (
        <View
          className="gap-3 border-t border-border bg-background px-5 pt-3"
          style={{ paddingBottom: edges.includes("bottom") ? 12 : Math.max(insets.bottom, 12) }}
        >
          {footer}
        </View>
      ) : null}
      </Body>
    </SafeAreaView>
  );
}

/** Une barre fixe en bas (Envoyer, Enregistrer) doit rester au-dessus du clavier. */
function Body({ withFooter, children }: { withFooter: boolean; children: ReactNode }) {
  return withFooter ? <KeyboardAvoider>{children}</KeyboardAvoider> : <>{children}</>;
}
