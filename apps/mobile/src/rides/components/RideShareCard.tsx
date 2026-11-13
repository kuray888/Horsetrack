import { forwardRef, useMemo } from "react";
import { Text, View } from "react-native";
import { BrandMark } from "@/components/BrandMark";
import Svg, { Circle, Polyline } from "react-native-svg";
import { Image } from "@/components/AppImage";
import { formatClock, formatDistance, formatSpeed, projectRoute } from "@/rides/rideMath";
import { GAIT_LABEL } from "@/rides/components/GaitBreakdown";
import type { SessionRide } from "@/rides/types";
import { formatDate } from "@/lib/dateFormat";
import { cardSize, shareLabel, type ShareFormat } from "@/rides/shareCardLogic";
import { t } from "@/i18n";

/** Largeur affichée ; la capture est agrandie à 1080 px (story Instagram 9:16). */
export const SHARE_CARD_WIDTH = 300;
const ROUTE_H = 170;
const WHITE = "#ffffff";

/**
 * Carte d'une séance en direct à partager en story (« le modèle Strava ») :
 * cheval, chiffres clés, allures et tracé, aux couleurs de la marque.
 * Le tracé est dessiné SANS fond de carte : on voit la forme du parcours,
 * jamais l'endroit (aucune adresse d'écurie ne se devine). Couleurs fixes de
 * la marque, pas du thème : l'image doit être la même pour tout le monde.
 */
export const RideShareCard = forwardRef<View, {
  ride: SessionRide;
  route: { lat: number; lng: number }[];
  horseName: string | null;
  horsePhoto: string | null;
  activity: string;
  format?: ShareFormat;
  /** Code de parrainage affiché au pied de la carte ; omis sans code. */
  code?: string | null;
}>(function RideShareCard({ ride, route, horseName, horsePhoto, activity, format = "story", code = null }, ref) {
  const size = cardSize(format, SHARE_CARD_WIDTH);
  const square = format === "square";
  const codeLine = shareLabel(code);
  const inner = SHARE_CARD_WIDTH - 40;
  const routeH = square ? 110 : ROUTE_H;
  const points = useMemo(() => (route.length > 1 ? projectRoute(route, inner, routeH, 10) : []), [route, inner, routeH]);
  const gaits = (["walk", "trot", "canter"] as const)
    .map((g) => ({ g, s: g === "walk" ? ride.walkSeconds : g === "trot" ? ride.trotSeconds : ride.canterSeconds }))
    .filter((x) => x.s > 0);
  const gaitTotal = gaits.reduce((a, x) => a + x.s, 0);
  const shades = { walk: "rgba(255,255,255,0.45)", trot: "rgba(255,255,255,0.7)", canter: WHITE };

  return (
    <View
      ref={ref}
      collapsable={false}
      style={{ width: size.width, height: size.height, backgroundColor: "#274c77", borderRadius: 20, padding: 20, overflow: "hidden" }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {horsePhoto ? (
          <Image source={{ uri: horsePhoto }} style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: WHITE }} />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={{ color: WHITE, fontSize: 22, fontFamily: "BricolageGrotesque_800ExtraBold" }} numberOfLines={1}>
            {horseName ?? activity}
          </Text>
          <Text style={{ color: "#d5e5f3", fontSize: 13 }} numberOfLines={1}>
            {horseName ? `${activity} · ` : ""}
            {formatDate(ride.startedAt)}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: square ? 12 : 22, gap: 14, flexDirection: square ? "row" : "column", flexWrap: "wrap" }}>
        <Big label={t("Durée")} value={formatClock(ride.durationSeconds)} small={square} />
        {ride.gps ? (
          <View style={{ flexDirection: "row", gap: square ? 14 : 18 }}>
            <Big label={t("Distance")} value={formatDistance(ride.distanceMeters)} small={square} />
            <Big label={t("Vitesse moy.")} value={formatSpeed(ride.avgSpeedKmh)} small={square} />
          </View>
        ) : null}
      </View>

      {gaitTotal > 0 && !square ? (
        <View style={{ marginTop: 18, gap: 6 }}>
          <View style={{ flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", gap: 2 }}>
            {gaits.map((x) => (
              <View key={x.g} style={{ flex: x.s / gaitTotal, backgroundColor: shades[x.g] }} />
            ))}
          </View>
          <Text style={{ color: "#d5e5f3", fontSize: 12 }}>
            {gaits.map((x) => `${GAIT_LABEL[x.g]} ${Math.round((x.s / gaitTotal) * 100)} %`).join(" · ")}
          </Text>
        </View>
      ) : null}

      <View style={{ flex: 1, justifyContent: "center" }}>
        {points.length > 1 ? (
          <Svg width={inner} height={routeH}>
            <Polyline
              points={points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={WHITE}
              strokeWidth={4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <Circle cx={points[0].x} cy={points[0].y} r={5} fill="#a3cef1" />
            <Circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={6} fill={WHITE} />
          </Svg>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <BrandMark size={22} style={{ tintColor: WHITE }} />
        <Text style={{ color: WHITE, fontSize: 15, fontFamily: "BricolageGrotesque_800ExtraBold" }}>Horsetrack</Text>
        <Text style={{ color: "#a3cef1", fontSize: 12, marginLeft: "auto" }}>{codeLine ?? "horsetrack.fr"}</Text>
      </View>
    </View>
  );
});

function Big({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  return (
    <View>
      <Text style={{ color: "#a3cef1", fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ color: WHITE, fontSize: small ? 22 : 34, fontFamily: "BricolageGrotesque_800ExtraBold" }}>{value}</Text>
    </View>
  );
}
