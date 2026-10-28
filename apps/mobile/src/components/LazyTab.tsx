import { useState, type ComponentType } from "react";
import { useIsFocused } from "expo-router";

/**
 * Ne monte un écran d'onglet qu'à sa première visite, puis le garde monté.
 *
 * La barre d'onglets native d'iOS (cf. app/(tabs)/_layout.tsx) rend tous
 * les onglets dès l'ouverture. Sans ce garde, le Planning, le Journal et le
 * Profil se calculeraient au démarrage alors qu'on arrive sur l'Accueil :
 * c'est le comportement de l'ancienne barre JS (montage à la première
 * visite) qu'on conserve ici, sur les deux plateformes.
 */
export function lazyTab<P extends object>(Screen: ComponentType<P>): ComponentType<P> {
  function LazyTabScreen(props: P) {
    const focused = useIsFocused();
    const [visited, setVisited] = useState(focused);
    // Ajustement pendant le rendu (pas d'effet) : l'écran se monte dans le
    // même passage que la sélection de l'onglet, sans image vide entre deux.
    if (focused && !visited) setVisited(true);
    return visited || focused ? <Screen {...props} /> : null;
  }
  LazyTabScreen.displayName = `lazyTab(${Screen.displayName ?? Screen.name ?? "Screen"})`;
  return LazyTabScreen;
}
