import { useMemo, useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import { useThemeColors } from "@/theme/ThemeProvider";
import { projectRoute } from "@/rides/rideMath";
import { t } from "@/i18n";

/**
 * Tracé du parcours, dessiné sans fond de carte : aucune clé d'API, aucun
 * réseau, et le même rendu sur iPhone et Android. Départ en vert, arrivée
 * (ou position actuelle) en couleur principale.
 */
export function RouteTrace({
  coords,
  height = 180,
  accessibilityLabel = t("Tracé du parcours"),
}: {
  coords: { lat: number; lng: number }[];
  height?: number;
  accessibilityLabel?: string;
}) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);
  const points = useMemo(() => (width > 0 ? projectRoute(coords, width, height, 14) : []), [coords, width, height]);

  return (
    <View
      className="overflow-hidden rounded-card bg-highlight/40"
      style={{ height }}
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {points.length > 1 ? (
        <Svg width={width} height={height}>
          <Polyline
            points={points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={colors.primary}
            strokeWidth={4}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Circle cx={points[0].x} cy={points[0].y} r={6} fill={colors.success} stroke={colors.surface} strokeWidth={2} />
          <Circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={7}
            fill={colors.primary}
            stroke={colors.surface}
            strokeWidth={2}
          />
        </Svg>
      ) : null}
    </View>
  );
}
