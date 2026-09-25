import { Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";

/** « Pour <cheval> » — rappelle en tête d'un formulaire à QUI l'entrée va
 * être rattachée. Les formulaires sont partagés entre des écrans qui n'ont
 * pas tous le même cadrage (Accueil et Agenda suivent le cheval actif,
 * Planning son filtre, la fiche cheval le cheval consulté) : sans ce rappel,
 * rien à l'écran ne dit sur quel cheval on est en train d'écrire, et une
 * entrée partait chez le mauvais sans qu'on puisse s'en apercevoir avant
 * l'enregistrement.
 *
 * Volontairement muet quand HorseMultiSelect est affiché (l'appelant ne passe
 * alors pas de nom) : les cases cochées disent déjà la même chose, en mieux.
 * Muet aussi tant que l'écurie ne compte qu'un cheval — même seuil que
 * HorseSwitcher : il n'y a alors aucune ambiguïté à lever, et le rappeler
 * dans chaque formulaire n'ajouterait que du bruit.
 *
 * Purement informatif — changer de cheval se fait via HorseSwitcher ou le
 * sélecteur, pas ici. */
export function HorseTargetNotice({ horseName }: { horseName: string | null | undefined }) {
  const colors = useThemeColors();
  const { horses } = useHorses();
  if (!horseName || horses.length <= 1) return null;
  return (
    <View
      className="flex-row items-center gap-1.5 rounded-card bg-highlight px-3 py-2"
      accessibilityLabel={`Entrée pour ${horseName}`}
    >
      <MaterialCommunityIcons name="horse-variant" size={14} color={colors.primary} accessibilityElementsHidden />
      <Text className="text-xs font-semibold text-primary">Pour {horseName}</Text>
    </View>
  );
}
