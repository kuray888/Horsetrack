import { Text, TouchableOpacity, View } from "react-native";
import { Link, router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Image } from "@/components/AppImage";
import { useThemeColors } from "@/theme/ThemeProvider";
import type { Horse } from "@/horses/store";
import { greeting } from "@/today/todayFormat";
import { t } from "@/i18n";

/** En-tête de l'Accueil : salutation, recherche, photo du cheval actif. */
export function TodayHeader({ horse }: { horse: Horse | null }) {
  const colors = useThemeColors();
  return (
    <View className="gap-4 rounded-card bg-primary p-5">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 gap-0.5 pr-3">
          <Text className="text-2xl font-display tracking-tight text-on-primary">{greeting()}</Text>
          <Text className="text-[15px] text-on-primary/80">
            {t("Prêt pour une séance avec ")}{horse?.name ?? t("ton cheval")} ?
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          {/* Recherche transversale (cf. app/search.tsx) — dans l'en-tête
              plutôt que dans un onglet : elle traverse toutes les
              sections, elle n'appartient à aucune. */}
          <TouchableOpacity
            onPress={() => router.push("/search")}
            accessibilityLabel={t("Rechercher")}
            accessibilityRole="button"
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full bg-on-primary/15"
          >
            <MaterialCommunityIcons name="magnify" size={20} color={colors.textOnPrimary} />
          </TouchableOpacity>
          {/* Raccourci vers la fiche du cheval : la photo est l'élément
              le plus visible de l'en-tête, on s'attend à pouvoir la toucher. */}
          {horse ? (
            // Link plutôt que router.push : il porte la transition zoom
            // (iOS 18+), la photo grandit jusqu'à la bannière de la fiche.
            <Link href={`/horse/${horse.id}`} asChild>
              <TouchableOpacity
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t("Ouvrir la fiche de {name}", { name: horse.name })}
              >
                <Link.AppleZoom>
                  <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-on-primary/15">
                    {horse.photoUrl ? (
                      <Image source={{ uri: horse.photoUrl }} style={{ width: 56, height: 56 }} />
                    ) : (
                      <MaterialCommunityIcons name="horse-variant" size={26} color={colors.textOnPrimary} />
                    )}
                  </View>
                </Link.AppleZoom>
              </TouchableOpacity>
            </Link>
          ) : (
            <View className="h-14 w-14 items-center justify-center rounded-full bg-on-primary/15">
              <MaterialCommunityIcons name="horse-variant" size={26} color={colors.textOnPrimary} />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
