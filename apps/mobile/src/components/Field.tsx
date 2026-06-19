import { ReactNode } from "react";
import { View, Text } from "react-native";

/** Label + champ, pour les formulaires (onboarding, agenda...). */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-muted">{label}</Text>
      {children}
    </View>
  );
}
