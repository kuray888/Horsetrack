import { useEffect, useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useSessions } from "@/sessions/store";
import { GAIT_LABEL } from "@/rides/components/GaitBreakdown";
import { classifyGait, decodePolyline, formatClock, formatSpeed, projectRoute } from "@/rides/rideMath";
import { gaitRuns, parseTrace, smoothAltitudes, traceStats } from "@/rides/trace";
import { linePoints } from "@/progress/series";
import { hapticSelection } from "@/lib/haptics";
import { track } from "@/lib/analytics";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const MAP_H = 240;
const CURVE_H = 72;

/** Relecture 2D d'une séance en direct : tracé coloré par allure, curseur dans
 * le temps, courbes de vitesse et d'altitude (cf. docs/seance-gps-relue.md, J1).
 * Sans fond de carte : aucun lieu n'est envoyé à un tiers. */
export default function RideReplayScreen() {
  const colors = useThemeColors();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const { sessions } = useSessions();
  const ride = sessions.find((s) => s.id === sessionId)?.ride ?? null;
  const rideRoute = ride?.route ?? null;
  const rideTrace = ride?.trace ?? null;
  const route = useMemo(() => (rideRoute ? decodePolyline(rideRoute) : []), [rideRoute]);
  const trace = useMemo(() => parseTrace(rideTrace, route.length), [rideTrace, route.length]);
  const [width, setWidth] = useState(0);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    track("ride_replay_opened");
  }, []);

  const gaitColor = { halt: colors.border, walk: colors.success, trot: colors.accent, canter: colors.primary } as const;
  const speeds = useMemo(() => (trace ? trace.s.map((v) => v / 10) : []), [trace]);
  const pts = useMemo(() => (width > 0 && route.length > 1 ? projectRoute(route, width, MAP_H, 16) : []), [route, width]);
  const runs = useMemo(() => gaitRuns(speeds), [speeds]);
  const stats = useMemo(() => (trace ? traceStats(trace) : null), [trace]);
  const alts = useMemo(() => (trace?.a ? smoothAltitudes(trace.a.map((v) => v / 10)) : null), [trace]);
  const speedLine = useMemo(() => (width > 0 ? linePoints(speeds, width, CURVE_H) : []), [speeds, width]);
  const altLine = useMemo(() => (width > 0 && alts ? linePoints(alts, width, CURVE_H) : []), [alts, width]);

  const header = (
    <View className="flex-row items-center justify-between">
          <Text className="flex-1 text-3xl font-display tracking-tight text-text" accessibilityRole="header">
            {t("Relire la séance")}
          </Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("Fermer")} onPress={() => router.back()} hitSlop={10}>
            <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
  );

  if (!ride || !trace) {
    return (
      <Screen>
      {header}
        <View className={`${CARD} items-center gap-3`}>
          <MaterialCommunityIcons name="map-marker-off-outline" size={28} color={colors.textMuted} />
          <Text className="text-center text-[15px] text-muted">
            {t("Le détail de cette séance n'est pas disponible : elle a été enregistrée avant la relecture.")}
          </Text>
        </View>
      </Screen>
    );
  }

  const i = Math.min(Math.max(cursor, 0), trace.t.length - 1);
  const step = Math.max(1, Math.round(trace.t.length / 40));
  const move = (to: number) => {
    const next = Math.min(Math.max(to, 0), trace.t.length - 1);
    if (next !== i) setCursor(next);
  };
  const fromTouch = (x: number) => (width > 0 ? Math.round((x / width) * (trace.t.length - 1)) : 0);
  const gait = classifyGait(speeds[i]);
  const cur = pts[i];
  const curveX = speedLine[i]?.x ?? 0;

  return (
    <Screen>
      <FadeInView>
        {header}
      </FadeInView>

      <FadeInView delay={40}>
        <View className={`${CARD} gap-4`}>
          <View
            className="overflow-hidden rounded-card bg-highlight/40"
            style={{ height: MAP_H }}
            onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
            accessible
            accessibilityRole="image"
            accessibilityLabel={t("Tracé du parcours coloré par allure")}
          >
            {pts.length > 1 ? (
              <Svg width={width} height={MAP_H}>
                {runs.map((r) => (
                  <Polyline
                    key={`${r.from}-${r.to}`}
                    points={pts.slice(r.from, r.to + 1).map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke={gaitColor[r.gait]}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                {cur ? <Circle cx={cur.x} cy={cur.y} r={8} fill={colors.text} stroke={colors.surface} strokeWidth={3} /> : null}
              </Svg>
            ) : null}
          </View>

          <View className="flex-row flex-wrap gap-3">
            {(["walk", "trot", "canter"] as const).map((g) => (
              <View key={g} className="flex-row items-center gap-2">
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: gaitColor[g] }} />
                <Text className="text-[13px] text-muted">{GAIT_LABEL[g]}</Text>
              </View>
            ))}
          </View>

          <View
            className="flex-row justify-between"
            accessible
            accessibilityLabel={t("À {time} : {gait}, {speed}", { time: formatClock(trace.t[i]), gait: GAIT_LABEL[gait], speed: formatSpeed(speeds[i]) })}
          >
            <View>
              <Text className="text-[11px] text-muted">{t("Temps")}</Text>
              <Text className="text-[17px] font-semibold text-text">{formatClock(trace.t[i])}</Text>
            </View>
            <View>
              <Text className="text-[11px] text-muted">{t("Allure")}</Text>
              <Text className="text-[17px] font-semibold text-text">{GAIT_LABEL[gait]}</Text>
            </View>
            <View>
              <Text className="text-[11px] text-muted">{t("Vitesse")}</Text>
              <Text className="text-[17px] font-semibold text-text">{formatSpeed(speeds[i])}</Text>
            </View>
            {alts ? (
              <View>
                <Text className="text-[11px] text-muted">{t("Altitude")}</Text>
                <Text className="text-[17px] font-semibold text-text">{t("{v} m", { v: Math.round(alts[i]) })}</Text>
              </View>
            ) : null}
          </View>

          {/* Courbe de vitesse : on la touche ou on la fait glisser pour rejouer la séance. */}
          <View
            style={{ height: CURVE_H }}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={t("Position dans la séance")}
            accessibilityValue={{ text: formatClock(trace.t[i]) }}
            accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
            onAccessibilityAction={(e) => {
              hapticSelection();
              move(i + (e.nativeEvent.actionName === "increment" ? step : -step));
            }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => move(fromTouch(e.nativeEvent.locationX))}
            onResponderMove={(e) => move(fromTouch(e.nativeEvent.locationX))}
          >
            {speedLine.length > 1 ? (
              <Svg width={width} height={CURVE_H} pointerEvents="none">
                <Polyline points={speedLine.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={colors.accent} strokeWidth={2} strokeLinejoin="round" />
                <Line x1={curveX} x2={curveX} y1={0} y2={CURVE_H} stroke={colors.text} strokeWidth={2} />
              </Svg>
            ) : null}
          </View>
          <View className="flex-row justify-between">
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("Plus tôt")} onPress={() => { hapticSelection(); move(i - step); }} hitSlop={8} className="flex-row items-center gap-1">
              <MaterialCommunityIcons name="chevron-left" size={20} color={colors.accent} />
              <Text className="text-[15px] font-semibold text-accent">{t("Plus tôt")}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("Plus tard")} onPress={() => { hapticSelection(); move(i + step); }} hitSlop={8} className="flex-row items-center gap-1">
              <Text className="text-[15px] font-semibold text-accent">{t("Plus tard")}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.accent} />
            </TouchableOpacity>
          </View>
        </View>
      </FadeInView>

      {alts && altLine.length > 1 ? (
        <FadeInView delay={80}>
          <View
            className={`${CARD} gap-3`}
            accessible
            accessibilityLabel={t("Dénivelé : {up} m de montée, {down} m de descente", { up: stats?.gain ?? 0, down: stats?.loss ?? 0 })}
          >
            <Text className="text-[17px] font-semibold text-text">{t("Dénivelé")}</Text>
            <Text className="text-[15px] text-muted">
              {t("{up} m de montée, {down} m de descente", { up: stats?.gain ?? 0, down: stats?.loss ?? 0 })}
            </Text>
            <Svg width={width} height={CURVE_H}>
              <Polyline points={altLine.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={colors.success} strokeWidth={2} strokeLinejoin="round" />
              <Line x1={altLine[i]?.x ?? 0} x2={altLine[i]?.x ?? 0} y1={0} y2={CURVE_H} stroke={colors.text} strokeWidth={2} />
            </Svg>
            <Text className="text-[11px] text-muted">{t("Altitude du GPS, lissée : à quelques mètres près.")}</Text>
          </View>
        </FadeInView>
      ) : null}
    </Screen>
  );
}
