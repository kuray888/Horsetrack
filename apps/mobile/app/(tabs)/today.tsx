import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { pushWidgetData } from "@/lib/widgetKit";
import { scheduleWeeklySummary } from "@/lib/notifications";
import { computeOvertrainingRisk } from "@/lib/overtrainingRisk";
import { CircularProgress } from "@/components/CircularProgress";
import { FadeInView } from "@/components/FadeInView";
import { WeekStreak } from "@/components/WeekStreak";
import { WeatherForecastStrip } from "@/components/WeatherForecastStrip";
import { DisciplineBreakdownCard } from "@/components/DisciplineBreakdownCard";
import { Screen } from "@/components/Screen";
import { Locked } from "@/components/Locked";
import { useCountUp } from "@/hooks/useCountUp";
import { colors } from "@/theme/colors";
import { MONTHS, isSameDate } from "@/lib/dateFormat";
import { useProgress } from "@/progress/store";
import { restDayActivityFor, useHorses } from "@/horses/store";
import { useProgram } from "@/program/store";
import { useAgenda, type AppointmentType } from "@/agenda/store";
import { maxHorses, useSubscription } from "@/subscription/store";
import { disciplineBreakdown, workloadScore } from "@/stats/compute";

/** Fenêtre glissante pour les statistiques avancées (répartition + charge) —
 * 14 jours, comme le plafond d'historique Free ailleurs dans l'app : assez
 * pour une tendance récente, pas un historique complet. */
const STATS_WINDOW_DAYS = 14;

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

// Classes statiques par type (NativeWind ne supporte pas les classes dynamiques `bg-${x}`)
const TYPE_META: Record<
  UpcomingType,
  { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; chip: string; tint: string; tag: string }
> = {
  seance: { label: "Séance", icon: "horse-variant", chip: "bg-primary/15", tint: colors.event.seance, tag: "text-primary" },
  veto: { label: "Vétérinaire", icon: "needle", chip: "bg-warning/15", tint: colors.event.veto, tag: "text-warning" },
  osteo: { label: "Ostéopathe", icon: "bone", chip: "bg-accent/15", tint: colors.event.osteo, tag: "text-accent" },
  marechal: { label: "Maréchal-ferrant", icon: "hammer", chip: "bg-primary/15", tint: colors.event.marechal, tag: "text-primary" },
  dentiste: { label: "Dentiste équin", icon: "tooth-outline", chip: "bg-success/15", tint: colors.event.dentiste, tag: "text-success" },
  concours: { label: "Compétition", icon: "trophy-outline", chip: "bg-accent/15", tint: colors.event.concours, tag: "text-accent" },
  autre: { label: "Rendez-vous", icon: "calendar-blank-outline", chip: "bg-border", tint: colors.event.autre, tag: "text-muted" },
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
  if (total === 0) return "Aucune séance prévue cette semaine.";
  if (done === 0) return "La semaine commence — à toi de jouer pour la première séance !";
  if (done === total) return `Semaine parfaite ! Les ${total} séances prévues sont faites. 🎉`;
  return `${done}/${total} séances faites cette semaine. Encore ${total - done} pour finir en beauté.`;
}

export default function TodayScreen() {
  const { isDone, xp, xpIntoLevel, xpGoal, level, weekStreak, bestWeekStreak } = useProgress();
  const { horses, selectedHorse, selectHorse } = useHorses();
  const { program, currentWeek, allSessions, isProgramComplete, bilanDismissed, adaptiveNote, feedbackTrend } = useProgram();
  const { appointments, journal } = useAgenda();
  const subscription = useSubscription();
  const { isGrandPrix } = subscription;
  const horseLimit = maxHorses(subscription);
  const ownedHorseIds = horses.filter((h) => !h.sharedRole).map((h) => h.id);
  const horse = selectedHorse;
  const xpAnimated = useCountUp(xp);

  const weekSessions = currentWeek?.sessions ?? [];
  const weekDoneCount = weekSessions.filter((s) => isDone(s.id)).length;
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // 0 = lundi ... 6 = dimanche (même convention que dayOffset/dayIndex ailleurs
  // dans l'app, cf. program/store.tsx).
  const todayDayOffset = (today.getDay() + 6) % 7;

  // Assiduité réelle : part des séances déjà passées (programme entier, pas
  // juste la semaine en cours) effectivement cochées comme faites — calculée
  // à partir des vraies données de progression, contrairement à l'ancienne
  // carte "Précision" qui affichait un chiffre fictif sans rien derrière.
  const pastSessions = allSessions.filter((s) => s.date <= todayStart);
  const pastDoneCount = pastSessions.filter((s) => isDone(s.id)).length;
  const adherenceTarget = pastSessions.length > 0 ? Math.round((pastDoneCount / pastSessions.length) * 100) : 0;
  const adherencePct = useCountUp(adherenceTarget);

  // Statistiques avancées — répartition par discipline (programme fait +
  // journal libre) et score de charge réel (programme uniquement, cf.
  // stats/compute.ts pour le détail des deux calculs).
  const statsWindowStart = new Date(todayStart);
  statsWindowStart.setDate(statsWindowStart.getDate() - STATS_WINDOW_DAYS);
  const doneSessionsInWindow = allSessions.filter((s) => isDone(s.id) && s.date >= statsWindowStart && s.date <= today);
  const horseJournalInWindow = journal.filter((j) => j.horseId === horse?.id && j.date >= statsWindowStart);
  const discipline = disciplineBreakdown(doneSessionsInWindow, horseJournalInWindow);
  const workload = workloadScore(doneSessionsInWindow, STATS_WINDOW_DAYS, today);

  const todaySession =
    weekSessions.find(
      (s) =>
        s.date.getFullYear() === today.getFullYear() &&
        s.date.getMonth() === today.getMonth() &&
        s.date.getDate() === today.getDate()
    ) ?? null;

  // "À venir" : fusion des prochaines séances (non faites) et rendez-vous Agenda,
  // triés par date — remplace l'ancienne liste mockée, déconnectée des vraies données.
  const upcoming: UpcomingItem[] = [
    // Les séances de programme ne sont des items "à venir" actionnables que pour Grand Prix.
    ...(isGrandPrix
      ? allSessions
          .filter((s) => s.date >= todayStart && !isDone(s.id))
          .map((s) => ({ id: `session-${s.id}`, type: "seance" as const, title: s.title, date: s.date, when: formatWhen(s.date, s.time) }))
      : []),
    ...appointments
      .filter((a) => a.date >= todayStart && a.horseId === horse?.id)
      .map((a) => ({ id: `appt-${a.id}`, type: a.type, title: a.title, date: a.date, when: formatWhen(a.date, a.time) })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const weekStreakDots = Array.from({ length: 7 }, (_, i) => {
    const session = weekSessions.find((s) => s.dayIndex === i);
    return session ? isDone(session.id) : false;
  });

  // Synchronise le widget iOS dès que les données de la journée ou la
  // progression changent — best-effort, silencieux hors iOS/EAS build.
  useEffect(() => {
    pushWidgetData({
      horseName: horse?.name ?? "Mon cheval",
      todaySessionTitle: todaySession?.title ?? null,
      todaySessionDurationMin: todaySession?.durationMin ?? null,
      todaySessionTime: todaySession?.time ?? null,
      weeklyDone: weekDoneCount,
      weeklyTotal: weekSessions.length,
    });
  }, [horse?.id, todaySession?.title, todaySession?.durationMin, todaySession?.time, weekDoneCount, weekSessions.length]);

  // Programme le bilan du dimanche soir une fois par semaine.
  // Guard dans scheduleWeeklySummary : aucun effect si déjà planifié cette semaine.
  useEffect(() => {
    if (!horse) return;
    scheduleWeeklySummary(horse.name, weekDoneCount, weekSessions.length);
  }, [horse?.id, weekDoneCount, weekSessions.length]);

  // Prédiction de surmenage — recalculée à chaque changement de feedbackTrend,
  // workload ou cheval. Le dismiss se réinitialise automatiquement si le niveau
  // de risque change (l'alerte redevient pertinente).
  const risk = useMemo(
    () => computeOvertrainingRisk(feedbackTrend ?? 0, workload, horse ?? null),
    [feedbackTrend, workload, horse]
  );
  const [riskDismissed, setRiskDismissed] = useState(false);
  const prevRiskLevel = useRef(risk.level);
  useEffect(() => {
    if (prevRiskLevel.current !== risk.level) {
      setRiskDismissed(false);
      prevRiskLevel.current = risk.level;
    }
  }, [risk.level]);

  return (
    <Screen>
      {/* En-tête */}
      <FadeInView>
        <View className="flex-row items-center justify-between">
          <View className="gap-0.5">
            <Text className="text-2xl font-extrabold tracking-tight text-text">{greeting()}</Text>
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

      {/* Bilan de fin de programme — proposé une fois la dernière semaine atteinte */}
      {isGrandPrix && isProgramComplete && !bilanDismissed ? (
        <FadeInView delay={30}>
          <TouchableOpacity
            onPress={() => router.push("/bilan-modal")}
            activeOpacity={0.85}
            className="flex-row items-center gap-3 rounded-card bg-surface p-4 shadow-card"
          >
            <View className="h-11 w-11 items-center justify-center rounded-full bg-accent/15">
              <MaterialCommunityIcons name="trophy-outline" size={22} color={colors.accent} />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-bold text-text">Programme terminé !</Text>
              <Text className="text-sm text-muted">Fais le point pour repartir sur un programme adapté.</Text>
            </View>
            <Text className="text-base text-muted">›</Text>
          </TouchableOpacity>
        </FadeInView>
      ) : null}

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

      {/* Programme — réservé au pack Grand Prix (cf. grille tarifaire) */}
      {isGrandPrix ? (
        <>
          {/* Alerte surmenage — masquée si risque nul ou ignorée par l'utilisateur */}
          {risk.level !== "none" && !riskDismissed ? (
            <FadeInView delay={70}>
              <View
                className={`rounded-card p-4 gap-2 border ${
                  risk.level === "alert"
                    ? "bg-warning/10 border-warning/40"
                    : "bg-accent/8 border-accent/25"
                }`}
              >
                <View className="flex-row items-start justify-between gap-2">
                  <Text className="flex-1 text-sm font-bold text-text">{risk.title}</Text>
                  <TouchableOpacity onPress={() => setRiskDismissed(true)} hitSlop={12}>
                    <Text className="text-base text-muted">✕</Text>
                  </TouchableOpacity>
                </View>
                <Text className="text-sm leading-5 text-muted">{risk.message}</Text>
                {risk.programAdapted ? (
                  <Text className="text-xs font-semibold text-success">
                    ✓ Programme des prochaines semaines allégé automatiquement
                  </Text>
                ) : (
                  <TouchableOpacity
                    onPress={() => router.push("/(tabs)/planning")}
                    activeOpacity={0.7}
                  >
                    <Text className="text-xs font-semibold text-accent">
                      Voir le planning →
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </FadeInView>
          ) : null}

          {/* CTA rapide */}
          <FadeInView delay={80}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                if (todaySession) {
                  router.push({ pathname: "/session-detail-modal", params: { id: todaySession.id } });
                } else {
                  const activity = horse ? restDayActivityFor(horse, todayDayOffset) : null;
                  Alert.alert(
                    "Jour de repos",
                    activity && horse
                      ? `Aucune séance aujourd'hui. ${horse.name} : ${activity.toLowerCase()}.`
                      : "Aucune séance n'est prévue aujourd'hui."
                  );
                }
              }}
              className="flex-row items-center justify-center gap-2 rounded-card bg-primary p-4"
            >
              <Text className="text-base font-bold text-on-primary">Démarrer une séance</Text>
            </TouchableOpacity>
          </FadeInView>

          {/* IA adaptative — repos auto après un rendez-vous vétérinaire, allègement par forte chaleur */}
          {adaptiveNote ? (
            <FadeInView delay={100}>
              <View className={`${CARD} flex-row items-center gap-3`}>
                <View className="h-10 w-10 items-center justify-center rounded-full bg-success/15">
                  <Text className="text-lg">🤖</Text>
                </View>
                <Text className="flex-1 text-sm leading-5 text-text">{adaptiveNote}</Text>
              </View>
            </FadeInView>
          ) : null}

          {/* Bilan de la semaine — généré à partir des vraies séances cochées dans Planning */}
          <FadeInView delay={120}>
            <View className={`${CARD} flex-row gap-3`}>
              <View className="h-10 w-10 items-center justify-center rounded-full bg-accent/15">
                <MaterialCommunityIcons name="chart-line" size={20} color={colors.accent} />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-bold uppercase tracking-wide text-accent">Bilan de la semaine</Text>
                <Text className="text-[15px] leading-5 text-text">
                  {weeklyRecapMessage(weekDoneCount, weekSessions.length)}
                </Text>
                <Text className="mt-1 text-xs text-muted">Focus : {program?.theme ?? "Ton programme arrive…"}</Text>
              </View>
            </View>
          </FadeInView>
        </>
      ) : (
        <FadeInView delay={80}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push("/paywall")}
            className={`${CARD} flex-row items-center gap-3`}
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/15">
              <Text className="text-lg">🔒</Text>
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-bold text-text">Programme d&apos;entraînement</Text>
              <Text className="text-sm text-muted">
                Réservé au pack Grand Prix — séances personnalisées générées chaque semaine.
              </Text>
            </View>
            <Text className="text-base text-muted">›</Text>
          </TouchableOpacity>
        </FadeInView>
      )}

      {/* Stats premium — gatées tant que l'utilisateur n'a pas d'abo/essai */}
      <Locked message="Suis ta progression avec l'abonnement">
        <View className="gap-4">
          {/* Streak */}
          <FadeInView delay={180}>
            <View className={CARD}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className="h-11 w-11 items-center justify-center rounded-full bg-warning/15">
                    <MaterialCommunityIcons name="fire" size={22} color={colors.warning} />
                  </View>
                  <View>
                    <Text className="text-xl font-extrabold text-text">{weekStreak} semaine{weekStreak !== 1 ? "s" : ""}</Text>
                    <Text className="text-sm text-muted">complète{weekStreak !== 1 ? "s" : ""} d&apos;affilée</Text>
                  </View>
                </View>
                <View className="rounded-full bg-highlight px-3 py-1.5">
                  <Text className="text-xs font-bold text-primary">Record {bestWeekStreak} sem.</Text>
                </View>
              </View>
              <View className="mt-4">
                <WeekStreak completed={weekStreakDots} />
              </View>
            </View>
          </FadeInView>

          {/* XP */}
          <FadeInView delay={240}>
            <View className={CARD}>
              <View className="flex-row items-center gap-5">
                <CircularProgress
                  progress={xpIntoLevel / xpGoal}
                  size={140}
                  strokeWidth={14}
                  trackColor={colors.background}
                  progressColor={colors.primary}
                >
                  <Text className="text-4xl font-extrabold tracking-tighter text-text">
                    {Math.round(xpAnimated)}
                  </Text>
                  <Text className="-mt-0.5 text-sm font-semibold text-muted">XP</Text>
                </CircularProgress>

                <View className="flex-1 gap-1">
                  <View className="mb-1 self-start rounded-full bg-highlight px-3 py-1">
                    <Text className="text-xs font-bold text-primary">Niveau {level}</Text>
                  </View>
                  <Text className="text-sm text-muted">Objectif</Text>
                  <Text className="text-xl font-bold text-text">{xpGoal} XP</Text>
                  <Text className="mt-2 text-sm text-muted">
                    Encore {xpGoal - xpIntoLevel} XP pour le niveau {level + 1}
                  </Text>
                </View>
              </View>
            </View>
          </FadeInView>

          {/* 2 cards stats côte à côte */}
          <FadeInView delay={280}>
            <View className="flex-row gap-4">
              <View className={`${CARD} flex-1 gap-1`}>
                <Text className="text-3xl font-extrabold tracking-tight text-text">
                  {program?.sessionsPerWeek ?? 0}
                </Text>
                <Text className="text-sm font-semibold text-muted">Séances/sem</Text>
              </View>
              <View className={`${CARD} flex-1 gap-1`}>
                <Text className="text-3xl font-extrabold tracking-tight text-text">
                  {Math.round(adherencePct)}%
                </Text>
                <Text className="text-sm font-semibold text-muted">Assiduité</Text>
                <Text className="text-xs text-muted">
                  {pastDoneCount}/{pastSessions.length} séances
                </Text>
              </View>
            </View>
          </FadeInView>

          {/* Statistiques avancées — répartition par discipline + charge réelle */}
          <FadeInView delay={320}>
            <View className={`${CARD} gap-3`}>
              <Text className="text-sm font-bold uppercase tracking-wide text-accent">
                Répartition par discipline
              </Text>
              <Text className="text-xs text-muted">Sur les {STATS_WINDOW_DAYS} derniers jours</Text>
              <DisciplineBreakdownCard stats={discipline} />
            </View>
          </FadeInView>

          <FadeInView delay={360}>
            <View className={`${CARD} flex-row items-center gap-3`}>
              <View className="h-11 w-11 items-center justify-center rounded-full bg-warning/15">
                <MaterialCommunityIcons name="speedometer" size={22} color={colors.warning} />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-bold uppercase tracking-wide text-accent">Charge d&apos;entraînement</Text>
                {isGrandPrix ? (
                  <Text className="text-[15px] leading-5 text-text">{workload.label}</Text>
                ) : (
                  <Text className="text-[15px] leading-5 text-text">
                    Calculée à partir du programme — disponible avec le pack Grand Prix.
                  </Text>
                )}
              </View>
            </View>
          </FadeInView>
        </View>
      </Locked>

      {/* Conseil du jour */}
      <FadeInView delay={340}>
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
      <FadeInView delay={400}>
        <View className="mt-1 flex-row items-center justify-between">
          <Text className="text-xl font-bold text-text">À venir</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/agenda")}>
            <Text className="text-sm font-semibold text-accent">Voir tout</Text>
          </TouchableOpacity>
        </View>
      </FadeInView>

      <FadeInView delay={440}>
        {upcoming.length === 0 ? (
          <View className={`${CARD} items-center gap-1`}>
            <Text className="text-2xl">🌿</Text>
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
