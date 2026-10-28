import { Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { FadeInView } from "@/components/FadeInView";
import { useThemeColors } from "@/theme/ThemeProvider";
import type { TrainingSession } from "@/sessions/store";
import { eventTime, type UnifiedEvent } from "@/planning/unifiedEvents";
import type { HorseAlert } from "@/horses/alerts";
import { formatWhen } from "@/today/todayFormat";
import { upcomingEventMeta } from "@/today/upcomingEventMeta";
import { t } from "@/i18n";

const CARD = "rounded-card bg-surface p-5 shadow-card";

/** Ouvre le formulaire de séance du Planning. `ts` rend chaque demande
 * unique (cf. planning.tsx, qui reste monté entre deux visites). */
function planSession() {
  router.push({ pathname: "/(tabs)/planning", params: { openForm: "session", ts: String(Date.now()) } });
}

/**
 * « Aujourd'hui » — en tête de l'écran, juste sous l'en-tête et les bannières
 * de sauvegarde : c'est le seul bloc où l'on agit au quotidien (une séance se
 * coche d'ici). Chaque événement n'apparaît qu'ici, jamais aussi dans
 * « Prochainement » (cf. useTodayOverview). « Planifier une séance » vit dans
 * cette carte : c'est là qu'on se demande quoi faire aujourd'hui.
 */
export function TodaySection({
  todayEvents,
  alerts,
  nextEvent,
  partnerToday,
  onToggleDone,
}: {
  todayEvents: UnifiedEvent[];
  alerts: HorseAlert[];
  nextEvent: UnifiedEvent | null;
  /** Prénom de la demi-pension si c'est son jour (cf. horse/[id]/demi-pension.tsx). */
  partnerToday: string | null;
  onToggleDone: (session: TrainingSession) => void;
}) {
  const colors = useThemeColors();
  return (
    <>
      <FadeInView delay={60}>
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-text" accessibilityRole="header">
            {t("Aujourd'hui")}
          </Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => router.push("/(tabs)/planning")} hitSlop={8}>
            <Text className="text-sm font-semibold text-accent">{t("Voir le planning")}</Text>
          </TouchableOpacity>
        </View>
        {partnerToday ? (
          <View className="mt-1 flex-row items-center gap-1.5">
            <MaterialCommunityIcons name="account-heart-outline" size={15} color={colors.accent} />
            <Text className="text-sm font-semibold text-accent">{t("C'est le jour de {name}", { name: partnerToday })}</Text>
          </View>
        ) : null}
      </FadeInView>

      <FadeInView delay={80}>
        {todayEvents.length === 0 ? (
          <View className={`${CARD} gap-3`}>
            <View className="gap-1.5">
              <Text className="text-[15px] font-semibold text-text">{t("Rien de prévu aujourd'hui.")}</Text>
              {/* « Rien de prévu » n'est pas « tout est à jour » : on dit ce
                  qui attend quand même, plutôt que de laisser une carte vide
                  qui se lit comme un feu vert. */}
              <Text className="text-sm leading-5 text-muted">
                {alerts.length > 0
                  ? t("{length} point{v} à surveiller plus bas{v2}.", { length: alerts.length, v: alerts.length > 1 ? "s" : "", v2: nextEvent ? t(", et {when} : {title}", { when: formatWhen(nextEvent.date).toLowerCase(), title: upcomingEventMeta(nextEvent).title }) : "" })
                  : nextEvent
                    ? t("Prochaine échéance {v} : {title}.", { v: formatWhen(nextEvent.date).toLowerCase(), title: upcomingEventMeta(nextEvent).title })
                    : t("Rien d'enregistré non plus pour les jours à venir — planifie une séance, ou note celle que tu viens de faire.")}
              </Text>
            </View>
            <TouchableOpacity accessibilityRole="button"
              activeOpacity={0.85}
              onPress={planSession}
              className="flex-row items-center justify-center gap-2 rounded-card bg-primary p-3.5"
            >
              <MaterialCommunityIcons name="plus" size={18} color={colors.textOnPrimary} />
              <Text className="text-base font-bold text-on-primary">{t("Planifier une séance")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={() => router.push("/ride")}
              className="flex-row items-center justify-center gap-2 rounded-card border border-primary/30 p-3.5"
            >
              <MaterialCommunityIcons name="play-circle-outline" size={18} color={colors.primary} />
              <Text className="text-base font-bold text-primary">{t("Démarrer une séance en direct")}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className={CARD}>
            {todayEvents.map((event, i) => {
              const meta = upcomingEventMeta(event);
              const time = eventTime(event);
              const session = event.kind === "session" ? event.session : null;
              return (
                <View
                  key={event.id}
                  className={`flex-row items-center gap-3 py-3.5 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <TouchableOpacity accessibilityRole="button"
                    onPress={() => router.push("/(tabs)/planning")}
                    activeOpacity={0.7}
                    className="flex-1 flex-row items-center gap-3"
                  >
                    <View className={`h-9 w-9 items-center justify-center rounded-full ${meta.chip}`}>
                      <MaterialCommunityIcons name={meta.icon} size={18} color={meta.tint} />
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text
                        className={`text-[15px] font-semibold ${session?.completed ? "text-muted line-through" : "text-text"}`}
                      >
                        {meta.title}
                      </Text>
                      <Text className="text-sm text-muted">{time ? `${meta.label} · ${time}` : meta.label}</Text>
                    </View>
                  </TouchableOpacity>
                  {session && !session.completed ? (
                    // Démarrer la séance prévue en direct : le chrono et le
                    // GPS la complètent (cochée, durée réelle, parcours).
                    <TouchableOpacity
                      onPress={() => router.push({ pathname: "/ride", params: { sessionId: session.id } })}
                      activeOpacity={0.6}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={t("Démarrer {title} en direct", { title: meta.title })}
                      className="h-8 w-8 items-center justify-center rounded-full bg-primary"
                    >
                      <MaterialCommunityIcons name="play" size={17} color={colors.textOnPrimary} />
                    </TouchableOpacity>
                  ) : null}
                  {session ? (
                    // Même case à cocher que les cartes du Planning (cf.
                    // SessionCard) : un seul geste pour « c'est fait »,
                    // partout dans l'app.
                    <TouchableOpacity
                      onPress={() => onToggleDone(session)}
                      activeOpacity={0.6}
                      hitSlop={12}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: session.completed }}
                      accessibilityLabel={session.completed ? t("Séance faite, marquer à faire") : t("Marquer la séance faite")}
                      className={`h-7 w-7 items-center justify-center rounded-full ${
                        session.completed ? "bg-success" : "border-2 border-border"
                      }`}
                    >
                      {session.completed ? <MaterialCommunityIcons name="check" size={17} color="#ffffff" /> : null}
                    </TouchableOpacity>
                  ) : (
                    <Text className={`text-xs font-bold ${meta.tag}`}>{meta.label}</Text>
                  )}
                </View>
              );
            })}
            <TouchableOpacity accessibilityRole="button"
              activeOpacity={0.7}
              onPress={planSession}
              className="flex-row items-center gap-3 border-t border-border pt-3.5"
            >
              <View className="h-9 w-9 items-center justify-center rounded-full bg-highlight">
                <MaterialCommunityIcons name="plus" size={18} color={colors.primary} />
              </View>
              <Text className="text-[15px] font-semibold text-primary">{t("Planifier une séance")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.7}
              onPress={() => router.push("/ride")}
              className="flex-row items-center gap-3 border-t border-border pt-3.5 mt-3.5"
            >
              <View className="h-9 w-9 items-center justify-center rounded-full bg-highlight">
                <MaterialCommunityIcons name="play-circle-outline" size={18} color={colors.primary} />
              </View>
              <Text className="text-[15px] font-semibold text-primary">{t("Démarrer une séance en direct")}</Text>
            </TouchableOpacity>
          </View>
        )}
      </FadeInView>
    </>
  );
}
