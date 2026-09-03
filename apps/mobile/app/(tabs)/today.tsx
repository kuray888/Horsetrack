import { useEffect } from "react";
import { Alert, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { pushWidgetData } from "@/lib/widgetKit";
import { scheduleWeeklySummary } from "@/lib/notifications";
import { FadeInView } from "@/components/FadeInView";
import { WeatherForecastStrip } from "@/components/WeatherForecastStrip";
import { Screen } from "@/components/Screen";
import { colors as staticColors } from "@/theme/colors";
import { useThemeColors } from "@/theme/ThemeProvider";
import { MONTHS, isSameDate } from "@/lib/dateFormat";
import { restDayActivityFor, useHorses } from "@/horses/store";
import { useSessions, type TrainingSession } from "@/sessions/store";
import { useAgenda, ACTIVITY_META, type AppointmentType } from "@/agenda/store";
import { maxHorses, useSubscription } from "@/subscription/store";

const TIPS = [
  "Varie les allures à l'échauffement pour mieux préparer les muscles de ton cheval.",
  "Un debrief de 2 minutes après la séance aide à mémoriser les progrès.",
  "Étire ton cheval en fin de séance pour limiter les courbatures.",
  "Mieux vaut une séance courte et régulière qu'une longue séance espacée.",
];

type UpcomingType = "seance" | AppointmentType;

type UpcomingItem = { id: string; type: UpcomingType; title: string; date: Date; when: string };

const DAY_SHORT_BY_GETDAY = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];

function formatWhen(date: Date, time?: string): string {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const suffix = time ? ` · ${time}` : "";
  if (isSameDate(date, todayStart)) return `Aujourd'hui${suffix}`;
  if (isSameDate(date, tomorrowStart)) return `Demain${suffix}`;
  return `${DAY_SHORT_BY_GETDAY[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}${suffix}`;
}

function sessionTitle(session: TrainingSession): string {
  return ACTIVITY_META[session.activityType].label;
}

// Classes statiques par type (NativeWind ne supporte pas les classes dynamiques `bg-${x}`)
const TYPE_META: Record<
  UpcomingType,
  { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; chip: string; tint: string; tag: string }
> = {
  seance: { label: "Séance", icon: "horse-variant", chip: "bg-primary/15", tint: staticColors.event.seance, tag: "text-primary" },
  veto: { label: "Vétérinaire", icon: "needle", chip: "bg-warning/15", tint: staticColors.event.veto, tag: "text-warning" },
  osteo: { label: "Ostéopathe", icon: "bone", chip: "bg-accent/15", tint: staticColors.event.osteo, tag: "text-accent" },
  marechal: { label: "Maréchal-ferrant", icon: "hammer", chip: "bg-primary/15", tint: staticColors.event.marechal, tag: "text-primary" },
  dentiste: { label: "Dentiste équin", icon: "tooth-outline", chip: "bg-success/15", tint: staticColors.event.dentiste, tag: "text-success" },
  concours: { label: "Compétition", icon: "trophy-outline", chip: "bg-accent/15", tint: staticColors.event.concours, tag: "text-accent" },
  autre: { label: "Rendez-vous", icon: "calendar-blank-outline", chip: "bg-border", tint: staticColors.event.autre, tag: "text-muted" },
};

// Carte blanche standard, réutilisée tel quel
const CARD = "rounded-card bg-surface p-5 shadow-card";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function dailyTip(): string {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.now() - start.getTime()) / 86_400_000);
  return TIPS[dayOfYear % TIPS.length];
}

function weeklyRecapMessage(done: number, total: number): string {
  if (total === 0) return "Aucune séance planifiée cette semaine.";
  if (done === 0) return "La semaine commence — à toi de planifier la première séance !";
  if (done === total) return `Semaine parfaite ! Les ${total} séances planifiées sont faites. 🎉`;
  return `${done}/${total} séances faites cette semaine. Encore ${total - done} pour finir en beauté.`;
}

export default function TodayScreen() {
  const colors = useThemeColors();
  const { horses, selectedHorse, selectHorse } = useHorses();
  const { sessions, toggleCompleted } = useSessions();
  const { appointments } = useAgenda();
  const subscription = useSubscription();
  const horseLimit = maxHorses(subscription);
  const ownedHorseIds = horses.filter((h) => !h.sharedRole).map((h) => h.id);
  const horse = selectedHorse;

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // 0 = lundi ... 6 = dimanche (même convention qu'ailleurs dans l'app).
  const todayDayOffset = (today.getDay() + 6) % 7;

  const horseSessions = sessions.filter((s) => s.horseId === horse?.id);
  const todaySession = horseSessions.find((s) => isSameDate(s.date, todayStart)) ?? null;

  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - todayDayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekSessions = horseSessions.filter((s) => s.date >= weekStart && s.date < weekEnd);
  const weekDoneCount = weekSessions.filter((s) => s.completed).length;

  // "À venir" : fusion des prochaines séances planifiées (non faites) et
  // rendez-vous Agenda, triés par date.
  const upcoming: UpcomingItem[] = [
    ...horseSessions
      .filter((s) => s.date >= todayStart && !s.completed)
      .map((s) => ({ id: `session-${s.id}`, type: "seance" as const, title: sessionTitle(s), date: s.date, when: formatWhen(s.date, s.time) })),
    ...appointments
      .filter((a) => a.date >= todayStart && a.horseId === horse?.id)
      .map((a) => ({ id: `appt-${a.id}`, type: a.type, title: a.title, date: a.date, when: formatWhen(a.date, a.time) })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Synchronise le widget iOS dès que les données de la journée changent —
  // best-effort, silencieux hors iOS/EAS build (actuellement no-op, cf.
  // lib/widgetKit.ts).
  useEffect(() => {
    pushWidgetData({
      horseName: horse?.name ?? "Mon cheval",
      todaySessionTitle: todaySession ? sessionTitle(todaySession) : null,
      todaySessionDurationMin: todaySession?.durationMinutes ?? null,
      todaySessionTime: todaySession?.time ?? null,
      weeklyDone: weekDoneCount,
      weeklyTotal: weekSessions.length,
    });
  }, [horse?.id, todaySession, weekDoneCount, weekSessions.length]);

  // Programme le bilan du dimanche soir une fois par semaine.
  useEffect(() => {
    if (!horse) return;
    scheduleWeeklySummary(horse.name, weekDoneCount, weekSessions.length);
  }, [horse?.id, weekDoneCount, weekSessions.length]);

  return (
    <Screen>
      {/* En-tête */}
      <FadeInView>
        <View className="flex-row items-center justify-between">
          <View className="gap-0.5">
            <Text className="text-2xl font-display tracking-tight text-text">{greeting()}</Text>
            <Text className="text-base text-muted">Prêt pour une séance avec {horse?.name ?? "ton cheval"} ?</Text>
          </View>
          <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-highlight">
            {horse?.photoUrl ? (
              <Image source={{ uri: horse.photoUrl }} className="h-14 w-14" />
            ) : (
              <MaterialCommunityIcons name="horse-variant" size={26} color={colors.primary} />
            )}
          </View>
        </View>
      </FadeInView>

      {/* Météo des prochains jours — purement indicatif, masqué si indisponible */}
      <FadeInView delay={20}>
        <WeatherForecastStrip />
      </FadeInView>

      {/* Sélecteur de cheval — visible seulement à partir de 2 chevaux dans l'écurie */}
      {horses.length > 1 ? (
        <FadeInView delay={40}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pr-2">
            {horses.map((h) => {
              const isSelected = h.id === horse?.id;
              // Les chevaux partagés (DP/coach) ne comptent jamais dans le
              // quota du palier — seul leur rang parmi les chevaux POSSÉDÉS
              // compte pour le verrouillage (cf. profile.tsx, même logique).
              const locked = !h.sharedRole && ownedHorseIds.indexOf(h.id) >= horseLimit;
              return (
                <TouchableOpacity
                  key={h.id}
                  onPress={() => (locked ? router.push("/paywall") : selectHorse(h.id))}
                  activeOpacity={0.8}
                  className="items-center gap-1"
                >
                  <View
                    className={`relative h-14 w-14 items-center justify-center overflow-hidden rounded-full ${
                      isSelected ? "border-2 border-primary bg-highlight" : "border border-border bg-surface"
                    } ${locked ? "opacity-40" : ""}`}
                  >
                    {h.photoUrl ? (
                      <Image source={{ uri: h.photoUrl }} className="h-14 w-14" />
                    ) : (
                      <MaterialCommunityIcons
                        name="horse-variant"
                        size={24}
                        color={isSelected ? colors.primary : colors.textMuted}
                      />
                    )}
                    {locked ? (
                      <View className="absolute inset-0 items-center justify-center bg-surface/50">
                        <Text className="text-sm">🔒</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    className={`max-w-[64px] text-center text-xs font-semibold ${
                      isSelected ? "text-primary" : "text-muted"
                    }`}
                    numberOfLines={1}
                  >
                    {h.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </FadeInView>
      ) : null}

      {/* CTA rapide — séance du jour ou planification */}
      <FadeInView delay={80}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            if (todaySession) {
              toggleCompleted(todaySession.id);
            } else {
              const activity = horse ? restDayActivityFor(horse, todayDayOffset) : null;
              Alert.alert(
                "Aucune séance aujourd'hui",
                activity && horse
                  ? `Rien de planifié aujourd'hui. ${horse.name} : ${activity.toLowerCase()}.`
                  : "Rien de planifié aujourd'hui — ajoute une séance depuis Planning."
              );
            }
          }}
          className="flex-row items-center justify-center gap-2 rounded-card bg-primary p-4"
        >
          <Text className="text-base font-bold text-on-primary">
            {todaySession
              ? todaySession.completed
                ? "Séance du jour marquée faite ✓"
                : "Marquer la séance du jour comme faite"
              : "Planifier une séance"}
          </Text>
        </TouchableOpacity>
      </FadeInView>

      {/* Bilan de la semaine — généré à partir des vraies séances cochées */}
      <FadeInView delay={120}>
        <View className={`${CARD} flex-row gap-3`}>
          <View className="h-10 w-10 items-center justify-center rounded-full bg-accent/15">
            <MaterialCommunityIcons name="chart-line" size={20} color={colors.accent} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-bold uppercase tracking-wide text-accent">Bilan de la semaine</Text>
            <Text className="text-[15px] leading-5 text-text">{weeklyRecapMessage(weekDoneCount, weekSessions.length)}</Text>
          </View>
        </View>
      </FadeInView>

      {/* Conseil du jour */}
      <FadeInView delay={160}>
        <View className={`${CARD} flex-row gap-3`}>
          <View className="h-10 w-10 items-center justify-center rounded-full bg-accent/15">
            <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color={colors.accent} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-bold uppercase tracking-wide text-accent">
              Conseil du jour
            </Text>
            <Text className="text-[15px] leading-5 text-text">{dailyTip()}</Text>
          </View>
        </View>
      </FadeInView>

      {/* À venir */}
      <FadeInView delay={200}>
        <View className="mt-1 flex-row items-center justify-between">
          <Text className="text-xl font-bold text-text">À venir</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/agenda")}>
            <Text className="text-sm font-semibold text-accent">Voir tout</Text>
          </TouchableOpacity>
        </View>
      </FadeInView>

      <FadeInView delay={240}>
        {upcoming.length === 0 ? (
          <View className={`${CARD} items-center gap-2`}>
            <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
              <MaterialCommunityIcons name="calendar-blank-outline" size={22} color={colors.textMuted} />
            </View>
            <Text className="text-sm text-muted">Rien de prévu pour l&apos;instant.</Text>
          </View>
        ) : (
          <View className={CARD}>
            {upcoming.slice(0, 3).map((item, i) => {
              const meta = TYPE_META[item.type];
              return (
                <View
                  key={item.id}
                  className={`flex-row items-center gap-3 py-3.5 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <View className={`h-9 w-9 items-center justify-center rounded-full ${meta.chip}`}>
                    <MaterialCommunityIcons name={meta.icon} size={18} color={meta.tint} />
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className="text-[15px] font-semibold text-text">{item.title}</Text>
                    <Text className="text-sm text-muted">{item.when}</Text>
                  </View>
                  <Text className={`text-xs font-bold ${meta.tag}`}>{meta.label}</Text>
                </View>
              );
            })}
          </View>
        )}
      </FadeInView>
    </Screen>
  );
}
