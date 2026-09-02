import { useEffect, useRef } from "react";
import { Tabs } from "expo-router";
import { Animated } from "react-native";
import { colors } from "@/theme/colors";

const TAB_ICONS: Record<string, string> = {
  today: "🏠",
  planning: "🏇",
  agenda: "🗓️",
  profile: "👤",
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;

  // Petit rebond quand l'onglet devient actif, pour marquer le changement.
  useEffect(() => {
    if (!focused) return;
    scale.setValue(0.7);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 14 }).start();
  }, [focused, scale]);

  return (
    <Animated.Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45, transform: [{ scale }] }}>
      {TAB_ICONS[name]}
    </Animated.Text>
  );
}

export default function TabsLayout() {
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
        options={{ title: "Today", tabBarIcon: ({ focused }) => <TabIcon name="today" focused={focused} /> }}
      />
      <Tabs.Screen
        name="planning"
        options={{ title: "Planning", tabBarIcon: ({ focused }) => <TabIcon name="planning" focused={focused} /> }}
      />
      <Tabs.Screen
        name="agenda"
        options={{ title: "Agenda", tabBarIcon: ({ focused }) => <TabIcon name="agenda" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profil", tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} /> }}
      />
    </Tabs>
  );
}
