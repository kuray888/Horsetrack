import { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Animated, Platform } from "react-native";
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

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const colors = useThemeColors();
  const [scale] = useState(() => new Animated.Value(1));

  // Petit rebond quand l'onglet devient actif, pour marquer le changement.
  useEffect(() => {
    if (!focused) return;
    scale.setValue(0.7);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 14 }).start();
  }, [focused, scale]);

  return (
    // Anime ce View plutôt que l'icône directement : sous la Nouvelle
    // Architecture (Fabric), la ref renvoyée par @expo/vector-icons n'expose
    // plus `setNativeProps` (retiré de RNVIconComponent), donc
    // Animated.createAnimatedComponent(MaterialCommunityIcons) plantait dès
    // scale.setValue() avec "undefined is not a function" — juste après la
    // connexion, à la toute première navigation vers les onglets. Animated.View
    // reste, lui, pleinement supporté par Fabric.
    <Animated.View style={{ transform: [{ scale }] }}>
      <MaterialCommunityIcons
        name={focused ? TAB_ICONS_FOCUSED[name] : TAB_ICONS[name]}
        size={24}
        color={focused ? colors.primary : colors.textMuted}
      />
    </Animated.View>
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
        // Hauteur imposée sur iOS seulement. La barre d'onglets ajoute
        // TOUJOURS la marge système du bas à l'intérieur de cette hauteur
        // (cf. BottomTabBar : `paddingBottom: insets.bottom`). Sur Android,
        // cette marge vaut la hauteur de la barre de navigation — environ
        // 48 dp avec les trois boutons — et il ne restait donc qu'une
        // douzaine de points pour l'icône et le libellé, tronqués. En la
        // laissant indéfinie, la barre se dimensionne elle-même à partir de
        // son contenu et de la marge réelle de l'appareil. iOS garde la
        // valeur d'origine, donc le rendu iPhone est strictement inchangé.
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: Platform.OS === "ios" ? 62 : undefined,
          paddingTop: 6,
        },
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
      {/* L'écran Agenda a été supprimé : ses trois sections ont rejoint la
          fiche cheval (app/horse/[id]/documents.tsx et budget.tsx) et le
          Planning (rendez-vous, création comme édition). C'était le
          remplacement annoncé par son propre commentaire — il restait une
          route sans entrée dans la barre, qui dupliquait le Planning. */}
    </Tabs>
  );
}
