import { router } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/** Écran de remplacement quand le Coach IA (Julien) n'est pas accessible —
 * réservé au palier Grand Prix, contrairement aux autres features "soft-gatées"
 * via <Locked> : pas de point à afficher un aperçu dégradé d'une conversation. */
export function CoachLocked({ onClose }: { onClose?: () => void }) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {onClose ? (
        <View className="flex-row justify-end px-5 pt-2">
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text className="text-xl text-muted">✕</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <Text className="text-3xl">🔒</Text>
        <Text className="text-center text-xl font-bold text-text">Julien, ton coach IA</Text>
        <Text className="text-center text-sm text-muted">
          Le Coach IA est réservé au pack Grand Prix — conseils personnalisés 24/7, programme d&apos;entraînement et
          statistiques avancées.
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/paywall")}
          className="rounded-full bg-primary px-6 py-3"
        >
          <Text className="text-sm font-bold text-on-primary">Découvrir Grand Prix</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
