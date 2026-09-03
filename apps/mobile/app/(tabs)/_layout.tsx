import { useEffect, useRef } from "react";
import { Tabs } from "expo-router";
import { Animated } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeColors } from "@/theme/ThemeProvider";

const TAB_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  today: "home-variant-outline",
  planning: "horse-variant",
  agenda: "calendar-month-outline",
  profile: "account-circle-outline",
};
const TAB_ICONS_FOCUSED: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  today: "home-variant",
  planning: "horse-variant",
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
        options={{ title: "Aujourd'hui", tabBarIcon: ({ focused }) => <TabIcon name="today" focused={focused} /> }}
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
