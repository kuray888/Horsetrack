import { Text, TouchableOpacity } from "react-native";
import { hapticTap } from "@/lib/haptics";

/**
 * Bouton d'un état vide (« Ajouter mon premier cheval », « Planifier une
 * séance ») : une vraie cible de 44 pt, pas un lien texte de 14 pt — c'est
 * souvent LA prochaine action à faire.
 */
export function EmptyStateButton({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => {
        hapticTap();
        onPress();
      }}
      activeOpacity={0.8}
      testID={testID}
      className="mt-1 min-h-[44px] items-center justify-center rounded-full bg-primary px-5"
    >
      <Text className="text-[15px] font-semibold text-on-primary">{label}</Text>
    </TouchableOpacity>
  );
}
