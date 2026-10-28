import { Linking, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@/components/ThemedIcon";
import { FadeInView } from "@/components/FadeInView";
import { CircularProgress } from "@/components/CircularProgress";
import { useThemeColors } from "@/theme/ThemeProvider";
import { ensureNotificationPermission, type NotificationPermissionState } from "@/lib/notifications";
import { dailyTip } from "@/lib/dailyTips";
import type { Discipline } from "@/onboarding/store";
import type { Horse } from "@/horses/store";
import type { HorseAlert } from "@/horses/alerts";
import { eventTime, type UnifiedEvent } from "@/planning/unifiedEvents";
import { formatWhen, weeklyRecapMessage } from "@/today/todayFormat";
import { upcomingEventMeta } from "@/today/upcomingEventMeta";
import { t } from "@/i18n";

/** Cartes secondaires de l'Accueil, sorties de app/(tabs)/today.tsx. */

const CARD = "rounded-card bg-surface p-5 shadow-card";

/** Bilan de l'année (décembre → mi-janvier, cf. review/yearReview.ts). */
export function YearReviewBanner({ horse, year }: { horse: Horse; year: number }) {
  const colors = useThemeColors();
  return (
    <FadeInView delay={56}>
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.85}
        onPress={() => router.push({ pathname: "/horse/[id]/annee", params: { id: horse.id, year: String(year) } })}
        className="flex-row items-center gap-3 rounded-card bg-surface p-4 shadow-card"
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-highlight">
          <MaterialCommunityIcons name="party-popper" size={20} color={colors.primary} />
        </View>
        <Text className="flex-1 text-[15px] font-semibold text-text">
          {t("Ton année {year} avec {name} est prête 🎉", { year, name: horse.name })}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    </FadeInView>
  );
}

export function DailyTipCard({ discipline }: { discipline: Discipline | null }) {
  const colors = useThemeColors();
  return (
    <FadeInView delay={53}>
      <View className="flex-row gap-3 rounded-card bg-highlight p-5">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
          <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color={colors.primary} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-bold uppercase tracking-wide text-primary">{t("Conseil du jour")}</Text>
          <Text className="text-[15px] leading-5 text-text">{dailyTip(new Date(), discipline)}</Text>
        </View>
      </View>
    </FadeInView>
  );
}

/** Météo de la prochaine séance : une information qui peut faire déplacer
 * une séance, donc en haut (cf. weather/sessionWeather.ts). */
export function WeatherWarningBanner({ warning }: { warning: { icon: string; date: Date; message: string } }) {
  const colors = useThemeColors();
  return (
    <FadeInView delay={54}>
      <TouchableOpacity accessibilityRole="button"
        activeOpacity={0.8}
        onPress={() => router.push("/(tabs)/planning")}
        className="flex-row items-center gap-2.5 rounded-card bg-warning/15 p-3.5"
      >
        <Text className="text-base">{warning.icon}</Text>
        <Text className="flex-1 text-sm text-text">
          {t("Séance ")}{formatWhen(warning.date).toLowerCase()} — {warning.message}.
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </FadeInView>
  );
}

/**
 * Notifications : la demande système ne part que d'ici (ou d'un rappel créé,
 * ou de l'écran de bienvenue Premium), sur appui, avec sa raison affichée
 * juste avant — jamais au lancement (cf. scheduleWeeklySummary). Une fois
 * refusées, l'OS ne la réaffiche plus : le bouton mène alors aux réglages.
 */
export function NotificationPrompt({
  state,
  horseName,
  onAnswer,
}: {
  state: NotificationPermissionState | null;
  horseName: string | null;
  onAnswer: (granted: boolean) => void;
}) {
  const colors = useThemeColors();
  return (
    <FadeInView delay={58}>
      {state === "denied" ? (
        <View className={`${CARD} flex-row items-center gap-3`}>
          <MaterialCommunityIcons name="bell-off-outline" size={20} color={colors.textMuted} />
          <Text className="flex-1 text-sm text-muted">
            {t("Notifications désactivées : tes rappels et ton bilan du dimanche ne s'afficheront pas sur ton téléphone.")}
          </Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => Linking.openSettings().catch(() => {})} activeOpacity={0.7} hitSlop={8}>
            <Text className="text-sm font-bold text-accent">{t("Réglages")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-row items-center gap-3 rounded-card bg-highlight p-4">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
            <MaterialCommunityIcons name="bell-ring-outline" size={20} color={colors.primary} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-[15px] font-bold text-text">{t("Ne rate rien pour ")}{horseName ?? t("ton cheval")}</Text>
            <Text className="text-sm text-muted">{t("Ton bilan du dimanche et tes rappels avant chaque soin.")}</Text>
          </View>
          <TouchableOpacity accessibilityRole="button"
            onPress={() =>
              ensureNotificationPermission()
                .then(onAnswer)
                .catch(() => {})
            }
            activeOpacity={0.85}
            className="rounded-full bg-primary px-4 py-2"
          >
            <Text className="text-sm font-bold text-on-primary">{t("Activer")}</Text>
          </TouchableOpacity>
        </View>
      )}
    </FadeInView>
  );
}

/** Alertes — échéance santé < 14j ou concours < 7j, tous chevaux confondus
 * (cf. horses/alerts.ts) ; rien affiché si aucune ne s'applique. */
export function AlertsCard({ alerts }: { alerts: HorseAlert[] }) {
  const colors = useThemeColors();
  return (
    <FadeInView delay={60}>
      <View className={`${CARD} gap-2`}>
        <View className="flex-row items-center gap-1.5">
          <MaterialCommunityIcons name="bell-alert-outline" size={16} color={colors.warning} />
          <Text className="text-xs font-bold uppercase tracking-wide text-warning">{t("À surveiller")}</Text>
        </View>
        {alerts.map((alert) => (
          <TouchableOpacity accessibilityRole="button"
            key={alert.horseId}
            onPress={() =>
              // Consulter l'alerte d'un autre cheval ne change pas le
              // cheval actif : c'était le cas le plus visible du recadrage
              // silencieux (on revenait sur un Accueil qui parlait d'un
              // autre cheval), et les écrans de destination se suffisent
              // désormais à eux-mêmes (cf. app/horse/[id]/index.tsx).
              // Une blessure en cours se suit dans Santé (bouton "Marquer
              // comme rétablie") plutôt que dans la fiche générale.
              router.push(alert.kind === "injury" ? `/horse/${alert.horseId}/sante` : `/horse/${alert.horseId}`)
            }
            activeOpacity={0.7}
            className="flex-row items-center gap-2"
          >
            <MaterialCommunityIcons
              name={alert.kind === "health" ? "heart-pulse" : alert.kind === "injury" ? "bandage" : "trophy-outline"}
              size={15}
              color={alert.kind === "concours" ? colors.accent : colors.warning}
            />
            <Text className="flex-1 text-sm text-text">
              <Text className="font-semibold">{alert.horseName}</Text> · {alert.message}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>
    </FadeInView>
  );
}

/** Prochainement — les jours suivants seulement (aujourd'hui est au-dessus). */
export function UpcomingCard({ events }: { events: UnifiedEvent[] }) {
  return (
    <>
      <FadeInView delay={140}>
        <View className="mt-1 flex-row items-center justify-between">
          <Text className="text-xl font-bold text-text">{t("Prochainement")}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => router.push("/(tabs)/planning")}>
            <Text className="text-sm font-semibold text-accent">{t("Voir tout")}</Text>
          </TouchableOpacity>
        </View>
      </FadeInView>
      <FadeInView delay={160}>
        <View className={CARD}>
          {events.map((event, i) => {
            const meta = upcomingEventMeta(event);
            const when = formatWhen(event.date, eventTime(event));
            return (
              <TouchableOpacity accessibilityRole="button"
                key={event.id}
                onPress={() => router.push("/(tabs)/planning")}
                activeOpacity={0.7}
                className={`flex-row items-center gap-3 py-3.5 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <View className={`h-9 w-9 items-center justify-center rounded-full ${meta.chip}`}>
                  <MaterialCommunityIcons name={meta.icon} size={18} color={meta.tint} />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-[15px] font-semibold text-text">{meta.title}</Text>
                  <Text className="text-sm text-muted">{when}</Text>
                </View>
                <Text className={`text-xs font-bold ${meta.tag}`}>{meta.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </FadeInView>
    </>
  );
}

/** Bilan de la semaine — second plan : il ne demande aucune action et ne se
 * périme pas dans la journée. */
export function WeekRecapCard({
  done,
  total,
  streak,
  horseName,
}: {
  done: number;
  total: number;
  streak: number;
  horseName: string | null;
}) {
  const colors = useThemeColors();
  return (
    <FadeInView delay={300}>
      <View className={`${CARD} flex-row items-center gap-3`}>
        <CircularProgress
          progress={total > 0 ? done / total : 0}
          size={44}
          strokeWidth={5}
          trackColor={colors.border}
          progressColor={colors.primary}
        >
          <Text className="text-[11px] font-bold text-text">
            {done}/{total}
          </Text>
        </CircularProgress>
        <View className="flex-1 gap-0.5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted">{t("Cette semaine")}</Text>
          <Text className="text-[13px] leading-[17px] text-text">{weeklyRecapMessage(done, total)}</Text>
          {streak >= 2 ? (
            <Text className="text-[13px] font-semibold text-primary">
              🔥 {streak} {t(" semaines d'affilée avec ")}{horseName ?? t("ton cheval")}
            </Text>
          ) : null}
        </View>
      </View>
    </FadeInView>
  );
}
