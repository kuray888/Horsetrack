import { Tabs, usePathname } from "expo-router";
import { Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { CoachBubble } from "@/components/CoachBubble";

const TAB_ICONS: Record<string, string> = {
  today: "🏠",
  planning: "🏇",
  agenda: "🗓️",
  coach: "💬",
  profile: "👤",
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{TAB_ICONS[name]}</Text>;
}

export default function TabsLayout() {
  const pathname = usePathname();
  const onCoachTab = pathname.includes("coach");

  return (
    <View style={{ flex: 1 }}>
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
          name="coach"
          options={{ title: "Coach", tabBarIcon: ({ focused }) => <TabIcon name="coach" focused={focused} /> }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: "Profil", tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} /> }}
        />
      </Tabs>
      {!onCoachTab ? <CoachBubble /> : null}
    </View>
  );
}
