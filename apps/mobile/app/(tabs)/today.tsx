import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { CircularProgress } from "@/components/CircularProgress";
import { FadeInView } from "@/components/FadeInView";
import { WeekStreak } from "@/components/WeekStreak";
import { Screen } from "@/components/Screen";
import { Locked } from "@/components/Locked";
import { useCountUp } from "@/hooks/useCountUp";
import { colors } from "@/theme/colors";
import { useProgress } from "@/progress/store";
import { useHorses } from "@/horses/store";
import { PROGRAM, SESSION_TEMPLATES, getCurrentWeek } from "@/program/data";

// --- Données mock (à brancher sur l'API plus tard) ---
const precision = { done: 18, target: 24 };

const TIPS = [
  "Varie les allures à l'échauffement pour mieux préparer les muscles de ton cheval.",
  "Un debrief de 2 minutes après la séance aide à mémoriser les progrès.",
  "Étire ton cheval en fin de séance pour limiter les courbatures.",
  "Mieux vaut une séance courte et régulière qu'une longue séance espacée.",
];

type UpcomingType = "seance" | "veto" | "competition";

const upcoming: { id: string; type: UpcomingType; title: string; when: string }[] = [
  { id: "1", type: "seance", title: "Séance dressage", when: "Aujourd'hui · 17h00" },
  { id: "2", type: "veto", title: "Rappel vaccin", when: "Demain · 09h00" },
  { id: "3", type: "competition", title: "Concours CSO", when: "Sam. 21 juin" },
  { id: "4", type: "seance", title: "Séance saut", when: "Lun. 23 juin · 18h00" },
];

// Classes statiques par type (NativeWind ne supporte pas les classes dynamiques `bg-${x}`)
const TYPE_META: Record<UpcomingType, { label: string; icon: string; chip: string; tag: string }> = {
  seance: { label: "Séance", icon: "🏇", chip: "bg-primary/15", tag: "text-primary" },
  veto: { label: "Vétérinaire", icon: "💉", chip: "bg-warning/15", tag: "text-warning" },
  competition: { label: "Compétition", icon: "🏆", chip: "bg-accent/15", tag: "text-accent" },
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
  const horse = selectedHorse;
  const xpAnimated = useCountUp(xp);
  const precisionTarget = Math.round((precision.done / precision.target) * 100);
  const precisionPct = useCountUp(precisionTarget);

  const currentWeek = getCurrentWeek();
  const weekSessions = currentWeek?.sessions ?? [];
  const weekDoneCount = weekSessions.filter((s) => isDone(s.id)).length;
  const weekStreakDots = Array.from({ length: 7 }, (_, i) => {
    const session = weekSessions.find((s) => s.dayIndex === i);
    return session ? isDone(session.id) : false;
  });

  return (
    <Screen>
      {/* En-tête */}
      <FadeInView>
        <View className="flex-row items-center justify-between">
          <View className="gap-0.5">
            <Text className="text-2xl font-extrabold tracking-tight text-text">{greeting()} 👋</Text>
            <Text className="text-base text-muted">Prêt pour une séance avec {horse?.name ?? "ton cheval"} ?</Text>
          </View>
          <View className="h-14 w-14 items-center justify-center rounded-full bg-highlight">
            <Text className="text-2xl">{horse?.emoji ?? "🐴"}</Text>
          </View>
        </View>
      </FadeInView>

      {/* Sélecteur de cheval — visible seulement à partir de 2 chevaux dans l'écurie */}
      {horses.length > 1 ? (
        <FadeInView delay={40}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pr-2">
            {horses.map((h) => {
              const isSelected = h.id === horse?.id;
              return (
                <TouchableOpacity
                  key={h.id}
                  onPress={() => selectHorse(h.id)}
                  activeOpacity={0.8}
                  className="items-center gap-1"
                >
                  <View
                    className={`h-14 w-14 items-center justify-center rounded-full ${
                      isSelected ? "border-2 border-primary bg-highlight" : "border border-border bg-surface"
                    }`}
                  >
                    <Text className="text-2xl">{h.emoji}</Text>
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

      {/* CTA rapide */}
      <FadeInView delay={80}>
        <TouchableOpacity
          activeOpacity={0.85}
          className="flex-row items-center justify-center gap-2 rounded-card bg-primary p-4"
        >
          <Text className="text-base font-bold text-on-primary">Démarrer une séance</Text>
        </TouchableOpacity>
      </FadeInView>

      {/* Bilan de la semaine — généré à partir des vraies séances cochées dans Planning */}
      <FadeInView delay={120}>
        <View className={`${CARD} flex-row gap-3`}>
          <Text className="text-2xl">📊</Text>
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-bold uppercase tracking-wide text-accent">Bilan de la semaine</Text>
            <Text className="text-[15px] leading-5 text-text">
              {weeklyRecapMessage(weekDoneCount, weekSessions.length)}
            </Text>
            <Text className="mt-1 text-xs text-muted">Focus : {PROGRAM.theme}</Text>
          </View>
        </View>
      </FadeInView>

      {/* Stats premium — gatées tant que l'utilisateur n'a pas d'abo/essai */}
      <Locked message="Suis ta progression avec l'abonnement">
        <View className="gap-4">
          {/* Streak */}
          <FadeInView delay={180}>
            <View className={CARD}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <Text className="text-3xl">🔥</Text>
                  <View>
                    <Text className="text-xl font-extrabold text-text">{weekStreak} semaine{weekStreak !== 1 ? "s" : ""}</Text>
                    <Text className="text-sm text-muted">complète{weekStreak !== 1 ? "s" : ""} d'affilée</Text>
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
                  {SESSION_TEMPLATES.length}
                </Text>
                <Text className="text-sm font-semibold text-muted">Séances/sem</Text>
              </View>
              <View className={`${CARD} flex-1 gap-1`}>
                <Text className="text-3xl font-extrabold tracking-tight text-text">
                  {Math.round(precisionPct)}%
                </Text>
                <Text className="text-sm font-semibold text-muted">Précision</Text>
                <Text className="text-xs text-muted">
                  {precision.done}/{precision.target} exercices
                </Text>
              </View>
            </View>
          </FadeInView>
        </View>
      </Locked>

      {/* Conseil du jour */}
      <FadeInView delay={340}>
        <View className={`${CARD} flex-row gap-3`}>
          <Text className="text-2xl">💡</Text>
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
          <TouchableOpacity>
            <Text className="text-sm font-semibold text-accent">Voir tout</Text>
          </TouchableOpacity>
        </View>
      </FadeInView>

      <FadeInView delay={440}>
        <View className={CARD}>
          {upcoming.slice(0, 3).map((item, i) => {
            const meta = TYPE_META[item.type];
            return (
              <View
                key={item.id}
                className={`flex-row items-center gap-3 py-3.5 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <View className={`h-9 w-9 items-center justify-center rounded-full ${meta.chip}`}>
                  <Text className="text-base">{meta.icon}</Text>
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
      </FadeInView>
    </Screen>
  );
}
