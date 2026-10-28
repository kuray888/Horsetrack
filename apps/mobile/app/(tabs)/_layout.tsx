import { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Animated, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeColors } from "@/theme/ThemeProvider";
import { t } from "@/i18n";

/** Le cavalier SF Symbols (`figure.equestrian.sports`) n'existe qu'à partir
 * d'iOS 17, et l'app vise encore iOS 16.4 : en dessous, un nom de symbole
 * inconnu donne un emplacement vide dans la barre. */
const HAS_EQUESTRIAN_SYMBOL = Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 17;

/**
 * Barre d'onglets native d'iOS (UITabBarController) : flou système, et sur
 * iOS 26 le verre « Liquid Glass » qui se réduit au défilement. Elle apporte
 * aussi gratuitement les gestes attendus d'une app iPhone : toucher l'onglet
 * déjà actif remonte la liste en haut.
 *
 * Les écrans y sont tous montés d'emblée (contrairement à la barre JS, qui
 * les montait à la première visite) : chaque écran d'onglet passe donc par
 * `lazyTab` (cf. components/LazyTab.tsx) pour garder un démarrage aussi
 * léger qu'avant.
 *
 * Le premier ScrollView de chaque onglet reçoit automatiquement la marge du
 * bas sous la barre (cf. `Screen`), le contenu défile donc derrière le verre
 * sans jamais rester caché dessous.
 */
function IosTabs() {
  const colors = useThemeColors();
  const content = { backgroundColor: colors.background };
  return (
    <NativeTabs tintColor={colors.primary} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="today" contentStyle={content}>
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} />
        <NativeTabs.Trigger.Label>{t("Accueil")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chevaux" contentStyle={content}>
        {HAS_EQUESTRIAN_SYMBOL ? (
          <NativeTabs.Trigger.Icon sf="figure.equestrian.sports" />
        ) : (
          <NativeTabs.Trigger.Icon src={<NativeTabs.Trigger.VectorIcon family={MaterialCommunityIcons} name="horse" />} />
        )}
        <NativeTabs.Trigger.Label>{t("Chevaux")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="planning" contentStyle={content}>
        <NativeTabs.Trigger.Icon sf="calendar" />
        <NativeTabs.Trigger.Label>{t("Planning")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="journal" contentStyle={content}>
        <NativeTabs.Trigger.Icon sf={{ default: "book.closed", selected: "book.closed.fill" }} />
        <NativeTabs.Trigger.Label>{t("Journal")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile" contentStyle={content}>
        <NativeTabs.Trigger.Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} />
        <NativeTabs.Trigger.Label>{t("Profil")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

const TAB_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  today: "home-variant-outline",
  chevaux: "horse",
  // Calendrier plutôt qu'une tête de cheval : deux chevaux côte à côte
  // (Chevaux, Planning) ne disaient pas lequel menait où.
  planning: "calendar-month-outline",
  journal: "notebook-outline",
  agenda: "calendar-month-outline",
  profile: "account-circle-outline",
};
const TAB_ICONS_FOCUSED: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  today: "home-variant",
  chevaux: "horse",
  planning: "calendar-month",
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
  if (Platform.OS === "ios") return <IosTabs />;
  return <JsTabs />;
}

/** Barre d'onglets JS, gardée telle quelle sur Android. */
function JsTabs() {
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
          // Explicite pour le mode sombre : par défaut la barre restait
          // blanche sous des écrans foncés.
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: Platform.OS === "ios" ? 62 : undefined,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{ title: t("Accueil"), tabBarIcon: ({ focused }) => <TabIcon name="today" focused={focused} /> }}
      />
      <Tabs.Screen
        name="chevaux"
        options={{ title: t("Chevaux"), tabBarIcon: ({ focused }) => <TabIcon name="chevaux" focused={focused} /> }}
      />
      <Tabs.Screen
        name="planning"
        options={{ title: t("Planning"), tabBarIcon: ({ focused }) => <TabIcon name="planning" focused={focused} /> }}
      />
      <Tabs.Screen
        name="journal"
        options={{ title: t("Journal"), tabBarIcon: ({ focused }) => <TabIcon name="journal" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t("Profil"), tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} /> }}
      />
      {/* L'écran Agenda a été supprimé : ses trois sections ont rejoint la
          fiche cheval (app/horse/[id]/documents.tsx et budget.tsx) et le
          Planning (rendez-vous, création comme édition). C'était le
          remplacement annoncé par son propre commentaire — il restait une
          route sans entrée dans la barre, qui dupliquait le Planning. */}
    </Tabs>
  );
}
