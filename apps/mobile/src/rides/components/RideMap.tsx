import { useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useTheme } from "@/theme/ThemeProvider";
import type { Gait } from "@/rides/rideMath";
import { gaitRuns } from "@/rides/trace";
import { cameraFor, mapTypeFor, type MapStyle } from "@/rides/mapViewLogic";

/**
 * Tracé d'une séance sur un fond Apple Plans (plan, satellite ou 3D) —
 * iPhone seulement, cf. mapViewLogic.ts (`mapAvailable`). Coloré par allure
 * quand `speedsKmh` est là, sinon d'une seule couleur (`lineColor`).
 * `interactive` faux : carte figée (carte partagée en story).
 */
export function RideMap(props: RideMapProps) {
  // Une carte neuve à chaque style ou tracé (départ masqué) : la caméra
  // d'Apple Plans, animée d'un style à l'autre, finissait loin du tracé.
  const first = props.coords[0];
  const key = `${props.mapStyle}-${props.coords.length}-${first?.lat}-${first?.lng}`;
  return <RideMapInner key={key} {...props} />;
}

type RideMapProps = {
  coords: { lat: number; lng: number }[];
  speedsKmh?: number[] | null;
  mapStyle: Exclude<MapStyle, "trace">;
  gaitColor: Record<Gait, string>;
  lineColor: string;
  startColor: string;
  endColor: string;
  /** Point mis en avant (curseur de la relecture). */
  cursorIndex?: number | null;
  cursorColor?: string;
  interactive?: boolean;
  /** Fond chargé : la carte partagée attend ce moment pour la capture. */
  onReady?: () => void;
  style?: StyleProp<ViewStyle>;
};

function RideMapInner({
  coords,
  speedsKmh = null,
  mapStyle,
  gaitColor,
  lineColor,
  startColor,
  endColor,
  cursorIndex = null,
  cursorColor,
  interactive = true,
  onReady,
  style,
}: RideMapProps) {
  const { scheme } = useTheme();
  const latLngs = useMemo(() => coords.map((c) => ({ latitude: c.lat, longitude: c.lng })), [coords]);
  const runs = useMemo(
    () => (speedsKmh && speedsKmh.length === coords.length ? gaitRuns(speedsKmh) : null),
    [speedsKmh, coords.length]
  );
  const camera = useMemo(() => cameraFor(coords, mapStyle), [coords, mapStyle]);
  if (latLngs.length < 2 || !camera) return null;
  const cursor = cursorIndex !== null ? latLngs[cursorIndex] : null;

  return (
    <MapView
      style={[{ flex: 1 }, style]}
      initialCamera={camera}
      mapType={mapTypeFor(mapStyle)}
      userInterfaceStyle={scheme === "dark" ? "dark" : "light"}
      showsPointsOfInterests={false}
      showsCompass={interactive}
      showsScale={false}
      showsUserLocation={false}
      toolbarEnabled={false}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      pitchEnabled={interactive}
      rotateEnabled={interactive}
      pointerEvents={interactive ? "auto" : "none"}
      onMapLoaded={onReady}
    >
      {/* Liseré clair sous le tracé : se lit sur un fond vert comme sur un satellite. */}
      <Polyline coordinates={latLngs} strokeColor="rgba(255,255,255,0.85)" strokeWidth={8} lineCap="round" lineJoin="round" />
      {runs ? (
        runs.map((r) => (
          <Polyline
            key={`${r.from}-${r.to}`}
            coordinates={latLngs.slice(r.from, r.to + 1)}
            strokeColor={gaitColor[r.gait]}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        ))
      ) : (
        <Polyline coordinates={latLngs} strokeColor={lineColor} strokeWidth={4} lineCap="round" lineJoin="round" />
      )}
      <Marker coordinate={latLngs[0]} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
        <Dot color={startColor} size={12} />
      </Marker>
      <Marker coordinate={latLngs[latLngs.length - 1]} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
        <Dot color={endColor} size={14} />
      </Marker>
      {cursor ? (
        <Marker coordinate={cursor} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <Dot color={cursorColor ?? endColor} size={18} />
        </Marker>
      ) : null}
    </MapView>
  );
}

function Dot({ color, size }: { color: string; size: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, borderWidth: 2, borderColor: "white" }} />;
}
