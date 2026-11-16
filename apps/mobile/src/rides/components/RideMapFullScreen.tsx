import { Modal, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { useThemeColors } from "@/theme/ThemeProvider";
import { hapticTap } from "@/lib/haptics";
import { gaitColorsFor } from "@/rides/gaitColors";
import { RideMap } from "@/rides/components/RideMap";
import { MapStylePicker } from "@/rides/components/MapStylePicker";
import type { MapStyle } from "@/rides/mapViewLogic";
import { t } from "@/i18n";

/**
 * Carte d'une séance en plein écran (« comme Strava ») : dans la relecture,
 * la carte est un aperçu fixe qui laisse défiler la page ; un toucher l'ouvre
 * ici, où on la déplace, on zoome et on change de fond.
 */
export function RideMapFullScreen({
  visible,
  onClose,
  coords,
  speedsKmh,
  mapStyle,
  styles,
  onStyleChange,
  cursorIndex,
}: {
  visible: boolean;
  onClose: () => void;
  coords: { lat: number; lng: number }[];
  speedsKmh: number[] | null;
  mapStyle: Exclude<MapStyle, "trace">;
  /** Fonds proposés ici (sans « Tracé seul » : on est sur la carte). */
  styles: MapStyle[];
  onStyleChange: (style: MapStyle) => void;
  cursorIndex: number | null;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View className="flex-1 bg-background">
        <RideMap
          coords={coords}
          speedsKmh={speedsKmh}
          mapStyle={mapStyle}
          gaitColor={gaitColorsFor(colors)}
          lineColor={colors.primary}
          startColor={colors.success}
          endColor={colors.primary}
          cursorIndex={cursorIndex}
          cursorColor={colors.text}
        />
        <View
          className="absolute left-0 right-0 flex-row items-center justify-between gap-3 px-4"
          style={{ top: insets.top + 8 }}
          pointerEvents="box-none"
        >
          <View className="flex-1 rounded-full bg-surface/90 p-1" pointerEvents="box-none">
            <MapStylePicker styles={styles} value={mapStyle} onChange={onStyleChange} noneLabel={t("Tracé seul")} />
          </View>
          <TouchableOpacity
            onPress={() => {
              hapticTap();
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel={t("Fermer la carte")}
            hitSlop={8}
            className="h-11 w-11 items-center justify-center rounded-full bg-surface shadow-card"
          >
            <MaterialCommunityIcons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
