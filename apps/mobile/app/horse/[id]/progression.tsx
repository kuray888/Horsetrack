import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import Svg, { Polyline, Rect, Circle } from "react-native-svg";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { useThemeColors } from "@/theme/ThemeProvider";
import { useHorses } from "@/horses/store";
import { useWeight } from "@/horses/weightStore";
import { useSessions } from "@/sessions/store";
import { barHeights, comparePeriods, linePoints, regularity, weeklySeries, weightTrend } from "@/progress/series";
import { track } from "@/lib/analytics";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";
const WEEKS = 12;
const CHART_H = 72;

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? t("{h} h {m} min", { h, m }) : t("{m} min", { m });
}

/**
 * Progression du cheval (cf. docs/progression-cheval.md, J1) : régularité,
 * charge de travail et poids sur 12 semaines, calculés sur ce qui est déjà
 * dans l'app. Graphiques en SVG maison, chacun avec son résumé pour VoiceOver.
 */
export default function HorseProgressionScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { horses } = useHorses();
  const { sessions } = useSessions();
  const { measurements } = useWeight();
  const horse = horses.find((h) => h.id === id);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    track("horse_progress_viewed");
  }, []);

  const now = useMemo(() => new Date(), []);
  const points = useMemo(() => (horse ? weeklySeries(sessions, horse.id, now, WEEKS) : []), [sessions, horse, now]);
  const reg = useMemo(() => regularity(points), [points]);
  const cmp = useMemo(() => comparePeriods(points, 4), [points]);
  const weights = useMemo(
    () => (horse ? measurements.filter((m) => m.horseId === horse.id).map((m) => ({ date: m.date, weightKg: m.weightKg })) : []),
    [measurements, horse]
  );
  const trend = useMemo(() => weightTrend(weights, now, 3), [weights, now]);

  if (!horse) {
    return (
      <Screen>
        <View className={`${CARD} items-center gap-2`}>
          <MaterialCommunityIcons name="horse-variant" size={28} color={colors.textMuted} />
          <Text className="text-sm text-muted">{t("Ce cheval est introuvable.")}</Text>
        </View>
      </Screen>
    );
  }

  const totalSessions = points.reduce((a, p) => a + p.sessions, 0);
  const bars = barHeights(points.map((p) => p.minutes), CHART_H);
  const barW = width > 0 ? width / points.length : 0;
  const sorted = [...weights].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(-12);
  const line = width > 0 ? linePoints(sorted.map((w) => w.weightKg), width, 56) : [];

  const regularityText = t("{a} semaines sur {n} avec au moins une séance", { a: reg.activeWeeks, n: reg.totalWeeks });
  const compareText =
    cmp.deltaPct === null
      ? t("{m} sur les 4 dernières semaines", { m: formatMinutes(cmp.current) })
      : t("{m} sur les 4 dernières semaines, {d} % par rapport aux 4 d'avant", {
          m: formatMinutes(cmp.current),
          d: `${cmp.deltaPct > 0 ? "+" : ""}${cmp.deltaPct}`,
        });

  return (
    <Screen>
      <FadeInView>
        <Text className="text-3xl font-display tracking-tight text-text" accessibilityRole="header">
          {t("Progression de {name}", { name: horse.name })}
        </Text>
        <Text className="mt-1 text-[13px] text-muted">{t("Les {n} dernières semaines, d'après tes séances faites.", { n: WEEKS })}</Text>
      </FadeInView>

      {totalSessions === 0 && !trend ? (
        <FadeInView delay={40}>
          <View className={`${CARD} items-center gap-3`}>
            <MaterialCommunityIcons name="chart-line" size={28} color={colors.textMuted} />
            <Text className="text-center text-[15px] text-muted">
              {t("Rien à montrer pour l'instant. Note tes séances comme faites, et la courbe apparaît ici.")}
            </Text>
          </View>
        </FadeInView>
      ) : (
        <>
          <FadeInView delay={40}>
            <View className={`${CARD} gap-3`} accessible accessibilityLabel={`${t("Régularité")} : ${regularityText}`}>
              <Text className="text-[17px] font-semibold text-text">{t("Régularité")}</Text>
              <Text className="text-[15px] text-muted">{regularityText}</Text>
              {reg.currentStreak > 1 ? (
                <Text className="text-[13px] font-semibold text-primary">
                  {t("{n} semaines d'affilée", { n: reg.currentStreak })}
                </Text>
              ) : null}
            </View>
          </FadeInView>

          <FadeInView delay={80}>
            <View className={`${CARD} gap-3`} accessible accessibilityLabel={`${t("Temps de travail par semaine")} : ${compareText}`}>
              <Text className="text-[17px] font-semibold text-text">{t("Temps de travail par semaine")}</Text>
              <Text className="text-[15px] text-muted">{compareText}</Text>
              <View onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))} style={{ height: CHART_H }}>
                {width > 0 ? (
                  <Svg width={width} height={CHART_H} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    {bars.map((h, i) => (
                      <Rect
                        key={points[i].weekStart.toISOString()}
                        x={i * barW + 2}
                        y={CHART_H - h}
                        width={Math.max(1, barW - 4)}
                        height={h}
                        rx={3}
                        fill={i === bars.length - 1 ? colors.primary : colors.accent}
                        opacity={h === 0 ? 0 : 1}
                      />
                    ))}
                  </Svg>
                ) : null}
              </View>
            </View>
          </FadeInView>

          {trend ? (
            <FadeInView delay={120}>
              <View
                className={`${CARD} gap-3`}
                accessible
                accessibilityLabel={t("Poids : {kg} kg, {d} kg en 3 mois", { kg: trend.lastKg, d: `${trend.deltaKg > 0 ? "+" : ""}${trend.deltaKg}` })}
              >
                <Text className="text-[17px] font-semibold text-text">{t("Poids")}</Text>
                <Text className="text-[15px] text-muted">
                  {t("{kg} kg, {d} kg en 3 mois", { kg: trend.lastKg, d: `${trend.deltaKg > 0 ? "+" : ""}${trend.deltaKg}` })}
                </Text>
                {line.length > 1 ? (
                  <Svg width={width} height={56} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <Polyline
                      points={line.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill="none"
                      stroke={colors.accent}
                      strokeWidth={2}
                      strokeLinejoin="round"
                    />
                    <Circle cx={line[line.length - 1].x} cy={line[line.length - 1].y} r={4} fill={colors.primary} />
                  </Svg>
                ) : null}
              </View>
            </FadeInView>
          ) : null}
        </>
      )}
    </Screen>
  );
}
