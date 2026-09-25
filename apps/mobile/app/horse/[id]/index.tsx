import { useLocalSearchParams } from "expo-router";
import { HorseHub } from "@/horses/components/HorseHub";

/**
 * Fiche cheval empilée au-dessus des onglets, ouverte depuis la liste des
 * chevaux ou une alerte de l'Accueil.
 *
 * Tout le contenu vit dans `HorseHub` (cf. ce composant) : le même écran est
 * rendu directement dans l'onglet « Chevaux » quand l'écurie ne compte qu'un
 * cheval, sans redirection — un écran qui redirige à son montage plantait en
 * TestFlight (cf. horses/horseHubNavigation.test.ts).
 */
export default function HorseHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HorseHub horseId={id} />;
}
