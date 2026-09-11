import { TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeColors } from "@/theme/ThemeProvider";

/** Chevron de retour réutilisable pour les écrans poussés (push, pas modale)
 * qui n'ont pas de header natif (cf. app/_layout.tsx, headerShown: false
 * partout) — le swipe iOS et le bouton Android fonctionnent déjà nativement,
 * ce composant n'ajoute que l'affordance visuelle, absente jusqu'ici en
 * dehors des modales (qui, elles, utilisent une icône "close" séparée, cf.
 * share-horse-modal.tsx).
 *
 * `onPress` optionnel : par défaut `router.back()`, mais un écran atteint en
 * traversant deux navigateurs différents (Stack racine → Tabs imbriqués,
 * ex: Horse Hub → onglet "agenda" cachée) doit fournir une cible explicite —
 * revenir vers un écran déjà présent à la base de la pile Tabs efface tout
 * ce qui était empilé par-dessus (dont le Horse Hub), laissant `router.back()`
 * sans historique où revenir (cf. audit pré-publication, `agenda.tsx`). */
export function BackButton({ onPress }: { onPress?: () => void }) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      onPress={onPress ?? (() => router.back())}
      hitSlop={12}
      accessibilityLabel="Retour"
      accessibilityRole="button"
      className="-ml-2 h-9 w-9 items-center justify-center"
    >
      <MaterialCommunityIcons name="chevron-left" size={26} color={colors.text} accessibilityElementsHidden />
    </TouchableOpacity>
  );
}
