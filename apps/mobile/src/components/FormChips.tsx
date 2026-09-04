import { Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export type IconSpec = { name: keyof typeof MaterialCommunityIcons.glyphMap; color: string };

/** Sélecteur à puces générique — icône MaterialCommunityIcons ou emoji (string).
 * Utilisé pour tous les formulaires (type, catégorie, discipline, humeur…). */
export function ChipSelect<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon: string | IconSpec }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
            accessibilityLabel={opt.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`flex-row items-center gap-1.5 rounded-full border px-3.5 py-2 ${
              selected ? "border-primary bg-highlight" : "border-border bg-surface"
            }`}
          >
            {typeof opt.icon === "string" ? (
              <Text className="text-sm" accessibilityElementsHidden importantForAccessibility="no">
                {opt.icon}
              </Text>
            ) : (
              <MaterialCommunityIcons name={opt.icon.name} size={15} color={opt.icon.color} accessibilityElementsHidden />
            )}
            <Text className={`text-sm font-semibold ${selected ? "text-primary" : "text-text"}`}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Bouton "+ Ajouter…" en pointillés. `color` est fourni par l'appelant (theme
 * statique ou useThemeColors) plutôt que résolu ici, pour ne changer le
 * comportement d'aucun écran existant. */
export function AddToggle({ label, onPress, color }: { label: string; onPress: () => void; color: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-primary p-4"
    >
      <MaterialCommunityIcons name="plus" size={18} color={color} />
      <Text className="text-base font-semibold text-primary">{label}</Text>
    </TouchableOpacity>
  );
}
