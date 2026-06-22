import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { ProgressBar } from "@/components/onboarding";
import { useProgress } from "@/progress/store";
import { useProgram, type PlannedSession } from "@/program/store";
import { WEEK_DAYS_FULL, DAY_LABELS as WEEK_DAYS_SHORT, formatDuration, isSameDate } from "@/lib/dateFormat";

const CARD = "rounded-card bg-surface p-5 shadow-card";

function SessionCard({ session, done, onPress }: { session: PlannedSession; done: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} className={`${CARD} flex-row items-center gap-3`}>
      <View
        className={`h-11 w-11 items-center justify-center rounded-full ${
          done ? "bg-success/15" : "bg-primary/15"
        }`}
      >
        <Text className="text-lg">{done ? "✓" : "🏇"}</Text>
      </View>
      <View className="flex-1 gap-0.5">
        <Text className={`text-base font-bold ${done ? "text-muted line-through" : "text-text"}`}>
          {session.title}
        </Text>
        <Text className="text-sm text-muted">
          {WEEK_DAYS_FULL[session.dayIndex]} · {session.time} · {session.durationMin} min
        </Text>
      </View>
      <Text className="text-base text-muted">›</Text>
    </TouchableOpacity>
  );
}

export default function PlanningScreen() {
  const { isDone, completedCount } = useProgress();
  const { program, weeks, allSessions, currentWeekNumber, getWeekDates, regenerate } = useProgram();

  function confirmRegenerate() {
    Alert.alert(
      "Nouveau programme ?",
      "Ton programme sera recalculé à partir de ton profil actuel (cavalier et cheval). Ta progression de la semaine en cours sera réinitialisée.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Régénérer", style: "destructive", onPress: regenerate },
      ]
    );
  }
  const [selectedWeek, setSelectedWeek] = useState(currentWeekNumber);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    setSelectedWeek(currentWeekNumber);
  }, [currentWeekNumber]);

  const today = new Date();
  const progressPct = allSessions.length > 0 ? Math.round((completedCount / allSessions.length) * 100) : 0;

  const weekDates = getWeekDates(selectedWeek);
  const weekSessions = weeks.find((w) => w.weekNumber === selectedWeek)?.sessions ?? [];
  const weekTotalMin = weekSessions.reduce((sum, s) => sum + s.durationMin, 0);
  const visibleSessions =
    selectedDay === null ? weekSessions : weekSessions.filter((s) => s.dayIndex === selectedDay);

  return (
    <Screen>
      <FadeInView>
        <View className="flex-row items-center justify-between">
          <Text className="text-3xl font-extrabold tracking-tight text-text">Planning</Text>
          <TouchableOpacity onPress={confirmRegenerate} activeOpacity={0.7} hitSlop={8}>
            <Text className="text-sm font-semibold text-accent">🔄 Nouveau programme</Text>
          </TouchableOpacity>
        </View>
      </FadeInView>

      <FadeInView delay={60}>
        <View className={`${CARD} gap-3`}>
          <View className="gap-1">
            <Text className="text-sm font-bold uppercase tracking-wide text-accent">
              🎯 {program?.title ?? "Programme en préparation…"}
            </Text>
            <Text className="text-sm text-muted">{program?.theme ?? ""}</Text>
          </View>

          <View className="gap-1.5">
            <ProgressBar step={completedCount} total={allSessions.length} />
            <Text className="text-sm font-semibold text-text">{progressPct}% du programme complété</Text>
          </View>

          <View className="flex-row justify-between border-t border-border pt-3">
            <View className="items-center gap-0.5">
              <Text className="text-base font-extrabold text-text">
                {currentWeekNumber}/{program?.totalWeeks ?? "—"}
              </Text>
              <Text className="text-xs text-muted">Semaine</Text>
            </View>
            <View className="items-center gap-0.5">
              <Text className="text-base font-extrabold text-text">{program?.sessionsPerWeek ?? 0}</Text>
              <Text className="text-xs text-muted">Séances/sem</Text>
            </View>
            <View className="items-center gap-0.5">
              <Text className="text-base font-extrabold text-text">{program?.totalWeeks ?? 0} sem.</Text>
              <Text className="text-xs text-muted">Durée totale</Text>
            </View>
          </View>
        </View>
      </FadeInView>

      {program && (program.personalizationNotes.length > 0 || program.safetyNotes.length > 0) ? (
        <FadeInView delay={90}>
          <View className={`${CARD} gap-2`}>
            <Text className="text-sm font-bold uppercase tracking-wide text-accent">Pourquoi ce programme</Text>
            {program.personalizationNotes.map((note, i) => (
              <Text key={`p${i}`} className="text-sm leading-5 text-text">
                💡 {note}
              </Text>
            ))}
            {program.safetyNotes.map((note, i) => (
              <Text key={`s${i}`} className="text-sm leading-5 text-warning">
                ⚠️ {note}
              </Text>
            ))}
          </View>
        </FadeInView>
      ) : null}

      <FadeInView delay={120}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-2">
          {weeks.map((week) => {
            const weekDone = week.sessions.every((s) => isDone(s.id));
            const isSelected = week.weekNumber === selectedWeek;
            const isCurrent = week.weekNumber === currentWeekNumber;
            return (
              <TouchableOpacity
                key={week.weekNumber}
                onPress={() => {
                  setSelectedWeek(week.weekNumber);
                  setSelectedDay(null);
                }}
                activeOpacity={0.8}
                className={`rounded-full px-4 py-2 ${
                  isSelected
                    ? "bg-primary"
                    : isCurrent
                      ? "border-2 border-primary bg-surface"
                      : "border border-border bg-surface"
                }`}
              >
                <Text className={`text-sm font-bold ${isSelected ? "text-on-primary" : "text-text"}`}>
                  S{week.weekNumber}
                  {weekDone ? " ✓" : ""}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </FadeInView>

      <FadeInView delay={160}>
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-text">Semaine {selectedWeek}</Text>
          <Text className="text-sm text-muted">
            {weekSessions.length} séances · {formatDuration(weekTotalMin)}
          </Text>
        </View>
      </FadeInView>

      <FadeInView delay={200}>
        <View className="flex-row justify-between">
          {weekDates.map((date, i) => {
            const hasSession = weekSessions.some((s) => isSameDate(s.date, date));
            const isToday = isSameDate(date, today);
            const isSelected = selectedDay === i;
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.8}
                onPress={() => setSelectedDay(isSelected ? null : i)}
                className="items-center gap-1.5"
              >
                <Text className="text-xs font-semibold text-muted">{WEEK_DAYS_SHORT[i]}</Text>
                <View
                  className={`h-10 w-10 items-center justify-center rounded-full ${
                    isSelected
                      ? "bg-primary"
                      : isToday
                        ? "border-2 border-primary bg-transparent"
                        : "bg-surface"
                  }`}
                >
                  <Text className={`text-sm font-bold ${isSelected ? "text-on-primary" : "text-text"}`}>
                    {date.getDate()}
                  </Text>
                </View>
                <View
                  className={`h-1.5 w-1.5 rounded-full ${
                    hasSession ? (isSelected ? "bg-primary" : "bg-accent") : "bg-transparent"
                  }`}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </FadeInView>

      {visibleSessions.length === 0 ? (
        <FadeInView delay={260}>
          <View className={`${CARD} items-center gap-1`}>
            <Text className="text-2xl">🌿</Text>
            <Text className="text-base font-semibold text-text">Jour de repos</Text>
            <Text className="text-sm text-muted">Pas de séance prévue ce jour-là.</Text>
          </View>
        </FadeInView>
      ) : (
        visibleSessions.map((session, i) => (
          <FadeInView key={session.id} delay={260 + i * 60}>
            <SessionCard
              session={session}
              done={isDone(session.id)}
              onPress={() => router.push({ pathname: "/session-detail-modal", params: { id: session.id } })}
            />
          </FadeInView>
        ))
      )}
    </Screen>
  );
}
