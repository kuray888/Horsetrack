import { useEffect, useRef } from "react";
import { Tabs } from "expo-router";
import { Animated } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeColors } from "@/theme/ThemeProvider";

const TAB_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  today: "home-variant-outline",
  chevaux: "horse",
  planning: "horse-variant",
  journal: "notebook-outline",
  agenda: "calendar-month-outline",
  profile: "account-circle-outline",
};
const TAB_ICONS_FOCUSED: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  today: "home-variant",
  chevaux: "horse",
  planning: "horse-variant",
  journal: "notebook",
  agenda: "calendar-month",
  profile: "account-circle",
};

const AnimatedIcon = Animated.createAnimatedComponent(MaterialCommunityIcons);

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const colors = useThemeColors();
  const scale = useRef(new Animated.Value(1)).current;

  // Petit rebond quand l'onglet devient actif, pour marquer le changement.
  useEffect(() => {
    if (!focused) return;
    scale.setValue(0.7);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 14 }).start();
  }, [focused, scale]);

  return (
    <AnimatedIcon
      name={focused ? TAB_ICONS_FOCUSED[name] : TAB_ICONS[name]}
      size={24}
      color={focused ? colors.primary : colors.textMuted}
      style={{ transform: [{ scale }] }}
    />
  );
}

export default function TabsLayout() {
  const colors = useThemeColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: true,
        tabBarStyle: { borderTopWidth: 1, borderTopColor: colors.border, height: 62, paddingTop: 6 },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{ title: "Accueil", tabBarIcon: ({ focused }) => <TabIcon name="today" focused={focused} /> }}
      />
      <Tabs.Screen
        name="chevaux"
        options={{ title: "Chevaux", tabBarIcon: ({ focused }) => <TabIcon name="chevaux" focused={focused} /> }}
      />
      <Tabs.Screen
        name="planning"
        options={{ title: "Planning", tabBarIcon: ({ focused }) => <TabIcon name="planning" focused={focused} /> }}
      />
      <Tabs.Screen
        name="journal"
        options={{ title: "Journal", tabBarIcon: ({ focused }) => <TabIcon name="journal" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profil", tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} /> }}
      />
      {/* Ancien écran Agenda (rendez-vous/documents/budget) — retiré de la
          barre d'onglets (remplacé à terme par le Horse Hub, cf. plan Phase 3
          Étape 2) mais PAS supprimé : reste une route valide, atteignable
          via router.push("/(tabs)/agenda") le temps que son remplacement
          soit fonctionnel et validé (cf. consigne explicite). */}
      <Tabs.Screen
        name="agenda"
        options={{ title: "Agenda", href: null, tabBarIcon: ({ focused }) => <TabIcon name="agenda" focused={focused} /> }}
      />
    </Tabs>
  );
}
