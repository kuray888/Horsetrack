import { useMemo, useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import { useThemeColors } from "@/theme/ThemeProvider";
import { projectRoute } from "@/rides/rideMath";
import { gaitColorsFor } from "@/rides/gaitColors";
import { gaitRuns } from "@/rides/trace";
import { t } from "@/i18n";

/**
 * Tracé du parcours, dessiné sans fond de carte : aucune clé d'API, aucun
 * réseau, et le même rendu sur iPhone et Android. Départ en vert, arrivée
 * (ou position actuelle) en couleur principale. Avec `speedsKmh` (une vitesse
 * par point, cf. rides/trace.ts), le tracé est coloré par allure — pas, trot,
 * galop, arrêt, comme dans la relecture ; sans, il garde une seule couleur.
 */
export function RouteTrace({
  coords,
  speedsKmh = null,
  height = 180,
  accessibilityLabel,
}: {
  coords: { lat: number; lng: number }[];
  /** Vitesse de chaque point de `coords`, dans le même ordre. */
  speedsKmh?: number[] | null;
  height?: number;
  accessibilityLabel?: string;
}) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);
  const points = useMemo(() => (width > 0 ? projectRoute(coords, width, height, 14) : []), [coords, width, height]);
  const gaitColor = useMemo(() => gaitColorsFor(colors), [colors]);
  const runs = useMemo(
    () => (speedsKmh && speedsKmh.length === coords.length ? gaitRuns(speedsKmh) : null),
    [speedsKmh, coords.length]
  );
  const label = accessibilityLabel ?? (runs ? t("Tracé du parcours coloré par allure") : t("Tracé du parcours"));

  return (
    <View
      className="overflow-hidden rounded-card bg-highlight/40"
      style={{ height }}
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {points.length > 1 ? (
        <Svg width={width} height={height}>
          {runs ? (
            runs.map((r) => (
              <Polyline
                key={`${r.from}-${r.to}`}
                points={points.slice(r.from, r.to + 1).map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={gaitColor[r.gait]}
                strokeWidth={4}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))
          ) : (
            <Polyline
              points={points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={colors.primary}
              strokeWidth={4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
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
