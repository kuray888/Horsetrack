import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "@/components/AppImage";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { maxHorses, useSubscription } from "@/subscription/store";
import { openPaywall } from "@/subscription/paywall";

/** Rangée horizontale d'avatars pour changer le cheval actif — un seul
 * composant partagé (cf. Accueil/Planning/Agenda), là où trois écrans
 * redisaient chacun cette logique un peu différemment (cf. audit du
 * 2026-09-16, section multi-chevaux). `selectHorse()` change le cheval actif
 * pour TOUTE l'app (Planning/Agenda/Accueil filtrent dessus) — c'est
 * volontaire, mais sa présence sur chaque onglet rend ce changement de
 * contexte visible et actionnable à l'endroit où on le remarque, plutôt que
 * de le subir silencieusement en revenant sur un autre onglet. Rien affiché
 * en dessous de 2 chevaux : aucun choix à faire avec un seul. */
export function HorseSwitcher({
  hideSelection = false,
  onSelect,
}: {
  /** Aucun avatar mis en avant : pour un écran dont la vue ne suit PAS le
   * cheval actif (Planning en vue « Tous »). Sans ça, l'anneau restait sur le
   * cheval actif pendant que la puce affichait « Tous » — deux indicateurs de
   * sélection qui se contredisent. */
  hideSelection?: boolean;
  /** Appelé après le changement de cheval actif. Permet à l'écran de recadrer
   * sa vue même quand on touche le cheval DÉJÀ actif (aucun changement de
   * contexte n'est alors détecté par le store). */
  onSelect?: (horseId: string) => void;
} = {}) {
  const colors = useThemeColors();
  const { horses, selectedHorse, selectHorse } = useHorses();
  const subscription = useSubscription();
  const horseLimit = maxHorses(subscription);
  // Les chevaux partagés (DP/coach) ne comptent jamais dans le quota du
  // palier — seul leur rang parmi les chevaux POSSÉDÉS compte pour le
  // verrouillage (cf. profile.tsx, même règle).
  const ownedHorseIds = horses.filter((h) => !h.sharedRole).map((h) => h.id);

  if (horses.length <= 1) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pr-2">
      {horses.map((h) => {
        const isSelected = !hideSelection && h.id === selectedHorse?.id;
        const locked = !h.sharedRole && ownedHorseIds.indexOf(h.id) >= horseLimit;
        return (
          <TouchableOpacity
            key={h.id}
            onPress={() => {
              if (locked) {
                openPaywall("horses", { feature: "locked_horse_switcher", horseId: h.id });
                return;
              }
              selectHorse(h.id);
              onSelect?.(h.id);
            }}
            activeOpacity={0.8}
            className="items-center gap-1"
            accessibilityRole="button"
            accessibilityLabel={locked ? `${h.name}, verrouillé, passer à Premium` : `Passer à ${h.name}`}
          >
            <View
              className={`relative h-14 w-14 items-center justify-center overflow-hidden rounded-full ${
                isSelected ? "border-2 border-primary bg-highlight" : "border border-border bg-surface"
              } ${locked ? "opacity-40" : ""}`}
            >
              {h.photoUrl ? (
                <Image source={{ uri: h.photoUrl }} style={{ width: 56, height: 56 }} />
              ) : (
                <MaterialCommunityIcons
                  name="horse-variant"
                  size={24}
                  color={isSelected ? colors.primary : colors.textMuted}
                />
              )}
              {locked ? (
                <View className="absolute inset-0 items-center justify-center bg-surface/50">
                  <Text className="text-sm">🔒</Text>
                </View>
              ) : null}
            </View>
            {/* Deux lignes plutôt qu'une coupée net : « Quinoa du Chêne »
                s'affichait « Quinoa du Ch… » pour toute une écurie aux noms
                longs, jusqu'à rendre deux chevaux indiscernables. La largeur
                reste bornée pour que la rangée garde son rythme, et
                `adjustsFontSizeToFit` rattrape les noms qui débordent encore
                sur iOS plutôt que de les tronquer. */}
            <Text
              className={`w-[68px] text-center text-xs font-semibold leading-[14px] ${
                isSelected ? "text-primary" : "text-muted"
              }`}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {h.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
