import { useEffect, useRef } from "react";
import type { LayoutChangeEvent, ScrollView } from "react-native";

/**
 * Fait défiler l'écran jusqu'à un formulaire quand il s'ouvre. Les formulaires
 * d'ajout/modification s'affichent à un endroit fixe de la page : ouverts
 * depuis un bouton ailleurs (carte Premiers pas, « + » flottant, modifier un
 * élément plus bas dans une liste), ils restaient hors de vue et l'appui
 * semblait ne rien faire.
 *
 * `scrollRef` va sur <Screen scrollRef>, `onAnchorLayout` sur une <View>
 * enfant DIRECT du contenu défilant qui contient le formulaire (la position
 * lue par onLayout est relative à son parent).
 */
export function useScrollToOnOpen(open: boolean) {
  const scrollRef = useRef<ScrollView>(null);
  const anchorY = useRef(0);

  useEffect(() => {
    if (!open) return;
    // Laisse le formulaire se monter (et une éventuelle feuille se fermer).
    const timer = setTimeout(
      () => scrollRef.current?.scrollTo({ y: Math.max(0, anchorY.current - 16), animated: true }),
      80
    );
    return () => clearTimeout(timer);
  }, [open]);

  return {
    scrollRef,
    onAnchorLayout: (e: LayoutChangeEvent) => {
      anchorY.current = e.nativeEvent.layout.y;
    },
  };
}
