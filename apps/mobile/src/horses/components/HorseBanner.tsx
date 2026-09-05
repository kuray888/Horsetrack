import { Image, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useThemeColors } from "@/theme/ThemeProvider";
import { DISCIPLINES, HORSE_LEVELS } from "@/onboarding/options";
import type { Horse } from "@/horses/store";

/** ~240dp (cf. audit Phase 8 tranche G, cible 220-260dp) : assez grand pour
 * rendre le cheval immédiatement identifiable, sans pousser les modules du
 * Horse Hub trop bas sur les petits écrans. */
const BANNER_HEIGHT = 240;

const ROLE_LABEL: Record<"DEMI_PENSION" | "COACH" | "RIDER" | "GROOM", string> = {
  DEMI_PENSION: "Demi-pension",
  COACH: "Coach / enseignant",
  RIDER: "Cavalière / cavalier",
  GROOM: "Groom / palefrenier",
};

function labelOf<T extends string>(options: { value: T; label: string }[], value: T): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

/**
 * Bannière d'identité du Horse Hub — photo en grand format (cover), lisible
 * immédiatement (cf. audit Phase 8 tranche G). Le crop/gradient sont purement
 * de l'affichage : ne touche pas au pipeline photo (toujours `horse.photoUrl`
 * tel quel, cf. lib/imagePicker.ts + cloudSync.ts uploadHorsePhoto) ni à
 * l'édition existante (`onEdit` pointe vers le même /edit-horse-modal que le
 * bouton "Modifier" en dessous — juste un raccourci en plus, pas un nouveau
 * flux). Le fallback sans photo réutilise les tokens de thème (bg-highlight,
 * text-text/muted) : cohérent avec les 6 palettes sans couleur en dur.
 */
export function HorseBanner({
  horse,
  isOwner,
  onEdit,
}: {
  horse: Horse;
  isOwner: boolean;
  onEdit: () => void;
}) {
  const colors = useThemeColors();
  const age = horse.birthYear ? `${new Date().getFullYear() - horse.birthYear} ans` : null;
  const subtitle = `${labelOf(DISCIPLINES, horse.discipline)} · ${labelOf(HORSE_LEVELS, horse.level)}`;
  const details = [horse.breed, horse.coat, age].filter(Boolean).join(" · ") || "Aucune info supplémentaire";
  const hasPhoto = !!horse.photoUrl;

  return (
    <View className="overflow-hidden rounded-card bg-highlight" style={{ height: BANNER_HEIGHT }}>
      {hasPhoto ? (
        <Image source={{ uri: horse.photoUrl! }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      ) : (
        <View className="h-full w-full items-center justify-center">
          <MaterialCommunityIcons name="horse-variant" size={72} color={colors.primary} />
        </View>
      )}

      {hasPhoto ? (
        <View className="absolute inset-x-0 bottom-0 h-32" pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="horseBannerFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity={0} />
                <Stop offset="1" stopColor="#000000" stopOpacity={0.68} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#horseBannerFade)" />
          </Svg>
        </View>
      ) : null}

      {isOwner ? (
        <TouchableOpacity
          onPress={onEdit}
          activeOpacity={0.85}
          accessibilityLabel="Modifier la photo du cheval"
          accessibilityRole="button"
          hitSlop={8}
          className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full bg-black/35"
        >
          <MaterialCommunityIcons name="pencil" size={16} color="#ffffff" />
        </TouchableOpacity>
      ) : null}

      <View className="absolute inset-x-0 bottom-0 gap-1 p-4">
        <View className="flex-row items-center gap-1.5">
          <Text
            className={`flex-1 text-2xl font-display-bold ${hasPhoto ? "text-white" : "text-text"}`}
            numberOfLines={1}
          >
            {horse.name}
          </Text>
          {horse.isPrimary ? (
            <MaterialCommunityIcons name="star" size={16} color={colors.warning} />
          ) : null}
        </View>
        {horse.sharedRole ? (
          <View className="flex-row items-center gap-1">
            <MaterialCommunityIcons
              name="handshake-outline"
              size={13}
              color={hasPhoto ? "#ffffff" : colors.accent}
            />
            <Text className={`text-xs font-semibold ${hasPhoto ? "text-white/90" : "text-accent"}`}>
              {ROLE_LABEL[horse.sharedRole]}
            </Text>
          </View>
        ) : null}
        <Text className={`text-sm ${hasPhoto ? "text-white/90" : "text-muted"}`} numberOfLines={1}>
          {subtitle}
        </Text>
        <Text className={`text-xs ${hasPhoto ? "text-white/75" : "text-muted"}`} numberOfLines={1}>
          {details}
        </Text>
      </View>
    </View>
  );
}
