import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Image } from "@/components/AppImage";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { maxHorses, useSubscription } from "@/subscription/store";
import { openPaywall } from "@/subscription/paywall";
import { t } from "@/i18n";

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
  allOption,
  selectedId,
  onLockedPress,
}: {
  /** Vignette « Tous » en tête de rangée (Planning, Journal) : le même
   * sélecteur sert à choisir un cheval ou toute l'écurie, au lieu d'une
   * rangée d'avatars ET d'une rangée de puces qui disaient presque la même
   * chose. Absente : rangée simple (Accueil). */
  allOption?: { selected: boolean; onSelect: () => void };
  /** Cheval à mettre en avant, quand l'écran en affiche un autre que le
   * cheval actif (ex. Journal ouvert depuis la fiche d'un cheval). Défaut :
   * le cheval actif. */
  selectedId?: string | null;
  /** Cheval verrouillé touché : ouvre le paywall par défaut. Le Journal, qui
   * ne fait que relire des souvenirs déjà écrits, peut choisir de simplement
   * filtrer (sans changer le cheval actif). */
  onLockedPress?: (horseId: string) => void;
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

  const allSelected = !!allOption?.selected;
  const highlightedId = selectedId !== undefined ? selectedId : selectedHorse?.id;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pr-2">
      {allOption ? (
        <TouchableOpacity
          onPress={allOption.onSelect}
          activeOpacity={0.8}
          className="items-center gap-1"
          accessibilityRole="button"
          accessibilityLabel={t("Tous les chevaux")}
          accessibilityState={{ selected: allSelected }}
        >
          <View
            className={`h-14 w-14 items-center justify-center rounded-full ${
              allSelected ? "border-2 border-primary bg-highlight" : "border border-border bg-surface"
            }`}
          >
            <MaterialCommunityIcons
              name="view-grid-outline"
              size={22}
              color={allSelected ? colors.primary : colors.textMuted}
            />
          </View>
          <Text className={`w-[68px] text-center text-xs font-semibold ${allSelected ? "text-primary" : "text-muted"}`}>
            {t("Tous")}
          </Text>
        </TouchableOpacity>
      ) : null}
      {horses.map((h) => {
        const isSelected = !hideSelection && !allSelected && h.id === highlightedId;
        const locked = !h.sharedRole && ownedHorseIds.indexOf(h.id) >= horseLimit;
        return (
          <TouchableOpacity
            key={h.id}
            onPress={() => {
              if (locked) {
                if (onLockedPress) onLockedPress(h.id);
                else openPaywall("horses", { feature: "locked_horse_switcher", horseId: h.id });
                return;
              }
              selectHorse(h.id);
              onSelect?.(h.id);
            }}
            activeOpacity={0.8}
            className="items-center gap-1"
            accessibilityRole="button"
            accessibilityLabel={locked && !onLockedPress ? t("{name}, verrouillé, passer à Premium", { name: h.name }) : t("Passer à {name}", { name: h.name })}
            accessibilityState={{ selected: isSelected }}
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
