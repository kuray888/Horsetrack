import { type ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeColors } from "@/theme/ThemeProvider";

/**
 * Section « détails facultatifs » d'un formulaire : repliée par défaut, à un
 * appui de l'ouverture.
 *
 * Les formulaires de l'app présentaient tout à plat — jusqu'à douze champs
 * pour un rendez-vous, dont la plupart restent vides la plupart du temps. Ce
 * qui compte pour enregistrer tient en trois ou quatre champs ; le reste se
 * déplie quand on en a besoin.
 *
 * `summary` est obligatoire et n'est pas décoratif : replier ne doit JAMAIS
 * cacher ce qui sera enregistré. Les champs masqués ont des valeurs
 * préremplies (une intensité, un rappel, une heure) qui partiraient sinon
 * sans que rien à l'écran ne les ait montrées. La ligne repliée les résume
 * donc, et devient un simple « Masquer les détails » une fois ouverte.
 *
 * Composant CONTRÔLÉ : l'écran décide de l'état initial — replié à la
 * création, déplié en édition, où tout ce qui a déjà été saisi doit rester
 * visible.
 */
export function FormDetails({
  open,
  onToggle,
  summary,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  /** Ce que contiennent les champs repliés, en une ligne (cf. ci-dessus). */
  summary: string;
  children: ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? "Masquer les détails" : `Afficher les détails : ${summary}`}
        className="flex-row items-center gap-1.5 py-1"
      >
        <MaterialCommunityIcons
          name={open ? "chevron-down" : "chevron-right"}
          size={18}
          color={colors.textMuted}
          accessibilityElementsHidden
        />
        <Text className="flex-1 text-sm font-semibold text-muted" numberOfLines={1}>
          {open ? "Masquer les détails" : summary}
        </Text>
      </TouchableOpacity>
      {open ? <View className="gap-3">{children}</View> : null}
    </>
  );
}
