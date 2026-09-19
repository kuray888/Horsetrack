import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeColors } from "@/theme/ThemeProvider";

/** Puces « Tous » + un cheval par puce, pour filtrer l'AFFICHAGE d'une liste
 * multi-chevaux. Extrait tel quel du Journal (cf. (tabs)/journal.tsx, où ce
 * motif existait seul depuis l'origine) pour servir aussi au Planning — même
 * rendu, mêmes classes, aucun changement visuel de son côté.
 *
 * À ne pas confondre avec HorseSwitcher, qui change le cheval ACTIF de toute
 * l'app : ici rien ne sort de l'écran appelant. C'est aussi pourquoi la liste
 * des chevaux est passée en paramètre plutôt que lue depuis le store —
 * chaque écran décide de ce qu'il montre (le Journal inclut les chevaux
 * partagés, le Planning s'en tient aux chevaux possédés et non verrouillés,
 * cf. horses/selectableHorses.ts).
 *
 * `value` null = « Tous ». Rien n'est rendu en dessous de deux chevaux : il
 * n'y a alors aucun filtrage à proposer. */
export function HorseFilterChips({
  horses,
  value,
  onChange,
  allLabel = "Tous",
  showAll = true,
}: {
  horses: { id: string; name: string }[];
  value: string | null;
  onChange: (horseId: string | null) => void;
  allLabel?: string;
  /** Faux : pas de puce « Tous ». Le Planning la retire quand il n'y a pas au
   * moins deux chevaux proposables — « Tous » n'aurait alors rien à mêler et
   * afficherait les événements d'un seul cheval sous le nom d'un autre. */
  showAll?: boolean;
}) {
  if (horses.length <= 1) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-2">
      {showAll ? <Chip label={allLabel} selected={value === null} onPress={() => onChange(null)} /> : null}
      {horses.map((h) => (
        <Chip key={h.id} label={h.name} selected={value === h.id} onPress={() => onChange(h.id)} />
      ))}
    </ScrollView>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      className={`rounded-full border px-3.5 py-2 ${
        selected ? "border-primary bg-highlight" : "border-border bg-surface"
      }`}
    >
      <Text className={`text-sm font-semibold ${selected ? "text-primary" : "text-text"}`}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Pastille du nom d'un cheval, posée sur une entrée quand la liste en mêle
 * plusieurs (cf. Journal et Planning en vue « Tous »). Sans elle, deux
 * entrées créées d'un coup pour deux chevaux seraient indiscernables — et
 * c'est par elle qu'on désigne celle qu'on veut modifier ou supprimer, le
 * modèle ne connaissant aucune notion de série (cf. useAppointmentForm). */
export function HorseNameBadge({ name }: { name: string }) {
  const colors = useThemeColors();
  return (
    <View className="flex-row items-center gap-1 self-start rounded-full bg-highlight px-2.5 py-1">
      <MaterialCommunityIcons name="horse-variant" size={11} color={colors.primary} accessibilityElementsHidden />
      <Text className="text-xs font-semibold text-primary">{name}</Text>
    </View>
  );
}
