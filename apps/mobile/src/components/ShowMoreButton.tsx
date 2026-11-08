import { Text, TouchableOpacity } from "react-native";
import { animateNextLayout } from "@/lib/motion";
import { t } from "@/i18n";

/** Taille de page des listes qui grandissent avec l'usage (journal,
 * planning, dépenses) : tout rendre d'un coup ralentissait l'écran chez un
 * cavalier qui utilise l'app depuis longtemps. */
export const LIST_PAGE_SIZE = 20;

/** « Afficher la suite » en bas d'une liste affichée par pages. */
export function ShowMoreButton({ hidden, label, onPress }: { hidden: number; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={() => {
        animateNextLayout();
        onPress();
      }}
      activeOpacity={0.7}
      accessibilityRole="button"
      className="items-center rounded-card border border-border py-3"
    >
      <Text className="text-sm font-semibold text-accent">{label}</Text>
      <Text className="text-xs text-muted">{t("{n} restant{v}", { n: hidden, v: hidden > 1 ? "s" : "" })}</Text>
    </TouchableOpacity>
  );
}
