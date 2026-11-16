import { forwardRef, useMemo } from "react";
import { Text, View } from "react-native";
import { BrandMark } from "@/components/BrandMark";
import Svg, { Circle, Polyline } from "react-native-svg";
import { Image } from "@/components/AppImage";
import { formatClock, formatDistance, formatSpeed, projectRoute, type Gait } from "@/rides/rideMath";
import { gaitRuns } from "@/rides/trace";
import { GAIT_LABEL } from "@/rides/components/GaitBreakdown";
import type { SessionRide } from "@/rides/types";
import { formatDate } from "@/lib/dateFormat";
import { RideMap } from "@/rides/components/RideMap";
import type { MapStyle } from "@/rides/mapViewLogic";
import { cardSize, gaitShares, shareLabel, type ShareFormat } from "@/rides/shareCardLogic";
import { t } from "@/i18n";

/** Largeur affichée ; la capture est agrandie à 1080 px (story Instagram 9:16). */
export const SHARE_CARD_WIDTH = 300;
const ROUTE_H = 170;
const WHITE = "#ffffff";
const BRAND_BLUE = "#274c77";
const LIGHT_BLUE = "#a3cef1";
const PALE_BLUE = "#d5e5f3";
/** Allures sur le fond bleu de la carte : vert, ambre, corail, lisibles sur
 * #274c77 et distinctes même en petit (story vue sur un téléphone). Fixes,
 * comme le reste de la carte : l'image est la même pour tout le monde. */
const SHARE_GAIT_COLOR: Record<Gait, string> = {
  walk: "#7fe0a8",
  trot: "#ffd166",
  canter: "#ff8a65",
  halt: "rgba(255,255,255,0.4)",
};

/**
 * Carte d'une séance en direct à partager en story (« le modèle Strava ») :
 * cheval, chiffres clés, allures et tracé, aux couleurs de la marque.
 * Le tracé est coloré par allure quand la séance a sa trace détaillée
 * (`speedsKmh`, 1.3.0 et après), sinon blanc.
 * Par défaut, le tracé est dessiné SANS fond de carte : on voit la forme du
 * parcours, jamais l'endroit ; un fond Apple Plans s'ajoute seulement si on
 * le choisit (cf. RideShareBlock), départ et arrivée toujours masquables (aucune adresse d'écurie ne se devine). Couleurs fixes de
 * la marque, pas du thème : l'image doit être la même pour tout le monde.
 */
export const RideShareCard = forwardRef<View, {
  ride: SessionRide;
  route: { lat: number; lng: number }[];
  /** Vitesse de chaque point de `route` (même ordre) ; null : tracé blanc. */
  speedsKmh?: number[] | null;
  horseName: string | null;
  horsePhoto: string | null;
  activity: string;
  format?: ShareFormat;
  /** Fond Apple Plans sous le tracé (iPhone, choix explicite) ; « trace » : aucun. */
  mapStyle?: MapStyle;
  /** Fond de carte chargé : la capture peut se faire. */
  onMapReady?: () => void;
  /** Code de parrainage affiché au pied de la carte ; omis sans code. */
  code?: string | null;
}>(function RideShareCard({ ride, route, speedsKmh = null, horseName, horsePhoto, activity, format = "story", code = null, mapStyle = "trace", onMapReady }, ref) {
  const size = cardSize(format, SHARE_CARD_WIDTH);
  const square = format === "square";
  const codeLine = shareLabel(code);
  const inner = SHARE_CARD_WIDTH - 40;
  const routeH = square ? 110 : ROUTE_H;
  const points = useMemo(() => (route.length > 1 ? projectRoute(route, inner, routeH, 10) : []), [route, inner, routeH]);
  const runs = useMemo(
    () => (speedsKmh && speedsKmh.length === points.length ? gaitRuns(speedsKmh) : null),
    [speedsKmh, points.length]
  );
  const gaits = gaitShares(ride);

  return (
    <View
      ref={ref}
      collapsable={false}
      style={{ width: size.width, height: size.height, backgroundColor: BRAND_BLUE, borderRadius: 20, padding: 20, overflow: "hidden" }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {horsePhoto ? (
          <Image source={{ uri: horsePhoto }} style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: WHITE }} />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={{ color: WHITE, fontSize: 22, fontFamily: "BricolageGrotesque_800ExtraBold" }} numberOfLines={1}>
            {horseName ?? activity}
          </Text>
          <Text style={{ color: PALE_BLUE, fontSize: 13 }} numberOfLines={1}>
            {horseName ? `${activity} · ` : ""}
            {formatDate(ride.startedAt)}
          </Text>
        </View>
      </View>

      {/* Chaque chiffre a sa colonne et rétrécit au besoin : « 12,40 km » ou
          « 10,5 km/h » ne sortent jamais de la carte (story comme carré). */}
      {square ? (
        <View style={{ marginTop: 12, flexDirection: "row", gap: 12 }}>
          <Big label={t("Durée")} value={formatClock(ride.durationSeconds)} small />
          {ride.gps ? <Big label={t("Distance")} value={formatDistance(ride.distanceMeters)} small /> : null}
          {ride.gps ? <Big label={t("Vitesse moy.")} value={formatSpeed(ride.avgSpeedKmh)} small /> : null}
        </View>
      ) : (
        <View style={{ marginTop: 22, gap: 14 }}>
          <View style={{ flexDirection: "row" }}>
            <Big label={t("Durée")} value={formatClock(ride.durationSeconds)} />
          </View>
          {ride.gps ? (
            <View style={{ flexDirection: "row", gap: 16 }}>
              <Big label={t("Distance")} value={formatDistance(ride.distanceMeters)} />
              <Big label={t("Vitesse moy.")} value={formatSpeed(ride.avgSpeedKmh)} />
            </View>
          ) : null}
        </View>
      )}

      {gaits.length > 0 && !square ? (
        <View style={{ marginTop: 18, gap: 8 }}>
          <View style={{ flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", gap: 2 }}>
            {gaits.map((x) => (
              <View key={x.gait} style={{ flex: x.percent, backgroundColor: SHARE_GAIT_COLOR[x.gait] }} />
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 4 }}>
            {gaits.map((x) => (
              <View key={x.gait} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: SHARE_GAIT_COLOR[x.gait] }} />
                <Text style={{ color: PALE_BLUE, fontSize: 12 }}>{`${GAIT_LABEL[x.gait]} ${x.percent} %`}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {mapStyle !== "trace" && route.length > 1 ? (
        <View style={{ flex: 1, marginVertical: 14, borderRadius: 14, overflow: "hidden" }}>
          <RideMap
            coords={route}
            speedsKmh={speedsKmh}
            mapStyle={mapStyle}
            gaitColor={SHARE_GAIT_COLOR}
            lineColor={WHITE}
            startColor={LIGHT_BLUE}
            endColor={BRAND_BLUE}
            interactive={false}
            onReady={onMapReady}
          />
        </View>
      ) : (
      <View style={{ flex: 1, justifyContent: "center" }}>
        {points.length > 1 ? (
          <Svg width={inner} height={routeH}>
            {runs ? (
              runs.map((r) => (
                <Polyline
                  key={`${r.from}-${r.to}`}
                  points={points.slice(r.from, r.to + 1).map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke={SHARE_GAIT_COLOR[r.gait]}
                  strokeWidth={4}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))
            ) : (
              <Polyline
                points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={WHITE}
                strokeWidth={4}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            <Circle cx={points[0].x} cy={points[0].y} r={5} fill={LIGHT_BLUE} />
            <Circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={6} fill={WHITE} />
          </Svg>
        ) : null}
      </View>
      )}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <BrandMark size={22} style={{ tintColor: WHITE }} />
        <Text style={{ color: WHITE, fontSize: 15, fontFamily: "BricolageGrotesque_800ExtraBold" }}>Horsetrack</Text>
        <Text style={{ color: LIGHT_BLUE, fontSize: 12, marginLeft: "auto" }}>{codeLine ?? "horsetrack.fr"}</Text>
      </View>
    </View>
  );
});

function Big({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ color: LIGHT_BLUE, fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {label}
      </Text>
      <Text
        style={{ color: WHITE, fontSize: small ? 22 : 34, fontFamily: "BricolageGrotesque_800ExtraBold" }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {value}
      </Text>
    </View>
  );
}
