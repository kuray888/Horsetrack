import { Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";

/** Bulle flottante d'accès rapide au coach IA, affichée au-dessus des onglets. */
export function CoachBubble() {
  return (
    <TouchableOpacity
      onPress={() => router.push("/coach-modal")}
      activeOpacity={0.85}
      className="absolute bottom-[100px] right-5 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-card"
    >
      <Text className="text-2xl">🐴</Text>
    </TouchableOpacity>
  );
}
