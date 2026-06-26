import { useEffect, useState } from "react";
import { Alert, Animated, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { ProgressBar } from "@/components/onboarding";
import { usePressScale } from "@/hooks/usePressScale";
import { useProgress } from "@/progress/store";
import { useProgram, type PlannedSession } from "@/program/store";
import { useSubscription } from "@/subscription/store";
import { restDayActivityFor, useHorses } from "@/horses/store";
import { WEEK_DAYS_FULL, DAY_LABELS as WEEK_DAYS_SHORT, formatDuration, isSameDate } from "@/lib/dateFormat";
import { GlossaryText } from "@/components/GlossaryText";
import { GlossaryPopup } from "@/glossary/GlossaryProvider";

const CARD = "rounded-card bg-surface p-5 shadow-card";

function SessionCard({ session, done, onPress }: { session: PlannedSession; done: boolean; onPress: () => void }) {
  const { scale, onPressIn, onPressOut } = usePressScale();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        className={`${CARD} flex-row items-center gap-3`}
      >
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
    </Animated.View>
  );
}

/** Le programme d'entraînement (génération + suivi semaine par semaine) est
 * réservé au pack Grand Prix — Free et Paddock retombent sur le calendrier
 * manuel (cf. Agenda). Écran entier verrouillé, pas seulement les semaines
 * futures comme avant la refonte des paliers. */
function ProgramLocked() {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-4 px-6 py-20">
        <Text className="text-3xl">🔒</Text>
        <Text className="text-center text-xl font-bold text-text">Programme d&apos;entraînement</Text>
        <Text className="text-center text-sm text-muted">
          Le programme personnalisé sur 8 semaines, généré et ajusté pour ton cheval, est réservé au pack Grand
          Prix.
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/paywall")}
          className="rounded-full bg-primary px-6 py-3"
        >
          <Text className="text-sm font-bold text-on-primary">Découvrir Grand Prix</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

export default function PlanningScreen() {
  const { isDone, completedCount } = useProgress();
  const { program, weeks, allSessions, currentWeekNumber, getWeekDates, regenerate, feedbackNote, aiNote, adaptiveNote } =
    useProgram();
  const { isGrandPrix } = useSubscription();
  const { selectedHorse } = useHorses();

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

  if (!isGrandPrix) return <ProgramLocked />;

  const today = new Date();
  const progressPct = allSessions.length > 0 ? Math.round((completedCount / allSessions.length) * 100) : 0;

  const weekDates = getWeekDates(selectedWeek);
  const weekSessions = weeks.find((w) => w.weekNumber === selectedWeek)?.sessions ?? [];
  const weekTotalMin = weekSessions.reduce((sum, s) => sum + s.durationMin, 0);
  const visibleSessions =
    selectedDay === null ? weekSessions : weekSessions.filter((s) => s.dayIndex === selectedDay);

  return (
    <>
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

      {program &&
      (program.personalizationNotes.length > 0 ||
        program.safetyNotes.length > 0 ||
        feedbackNote ||
        aiNote ||
        adaptiveNote) ? (
        <FadeInView delay={90}>
          <View className={`${CARD} gap-2`}>
            <Text className="text-sm font-bold uppercase tracking-wide text-accent">Pourquoi ce programme</Text>
            {aiNote ? (
              <Text className="text-sm leading-5 text-text">
                <Text className="font-semibold">✨ Julien : </Text>
                {aiNote}
              </Text>
            ) : null}
            {adaptiveNote ? <Text className="text-sm leading-5 text-text">🤖 {adaptiveNote}</Text> : null}
            {feedbackNote ? <Text className="text-sm leading-5 text-text">🔁 {feedbackNote}</Text> : null}
            {program.personalizationNotes.map((note, i) => (
              <GlossaryText key={`p${i}`} text={`💡 ${note}`} className="text-sm leading-5 text-text" />
            ))}
            {program.safetyNotes.map((note, i) => (
              <GlossaryText key={`s${i}`} text={`⚠️ ${note}`} className="text-sm leading-5 text-warning" />
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
            {selectedHorse && selectedHorse.restDayActivities.length > 0 ? (
              <Text className="text-center text-sm text-muted">
                {selectedHorse.name} :{" "}
                {selectedDay !== null
                  ? restDayActivityFor(selectedHorse, selectedDay)?.toLowerCase()
                  : selectedHorse.restDayActivities.join(", ").toLowerCase()}
              </Text>
            ) : (
              <Text className="text-sm text-muted">Pas de séance prévue ce jour-là.</Text>
            )}
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
      <GlossaryPopup />
    </>
  );
}
