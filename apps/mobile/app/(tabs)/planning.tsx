import { useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Screen } from "@/components/Screen";
import { FadeInView } from "@/components/FadeInView";
import { ProgressBar } from "@/components/onboarding";
import { useProgress, type Debrief, type Mood } from "@/progress/store";
import {
  ALL_SESSIONS,
  CURRENT_WEEK_NUMBER,
  PROGRAM,
  PROGRAM_WEEKS,
  SESSION_TEMPLATES,
  WEEK_DAYS_FULL,
  WEEK_DAYS_SHORT,
  formatDuration,
  getWeekDates,
  isSameDate,
  type PlannedSession,
} from "@/program/data";

const CARD = "rounded-card bg-surface p-5 shadow-card";

const MOOD_META: Record<Mood, { emoji: string; label: string }> = {
  great: { emoji: "🤩", label: "Top" },
  good: { emoji: "🙂", label: "Bien" },
  okay: { emoji: "😐", label: "Moyen" },
  hard: { emoji: "😣", label: "Difficile" },
};

function SessionCard({
  session,
  expanded,
  done,
  debrief,
  onToggleExpand,
  onToggleDone,
  onSaveDebrief,
}: {
  session: PlannedSession;
  expanded: boolean;
  done: boolean;
  debrief: Debrief | null;
  onToggleExpand: () => void;
  onToggleDone: () => void;
  onSaveDebrief: (debrief: Debrief) => void;
}) {
  const [editingDebrief, setEditingDebrief] = useState(false);
  const [draftMood, setDraftMood] = useState<Mood | null>(debrief?.mood ?? null);
  const [draftNote, setDraftNote] = useState(debrief?.note ?? "");

  function handleSaveDebrief() {
    if (!draftMood) return;
    onSaveDebrief({ mood: draftMood, note: draftNote.trim() });
    setEditingDebrief(false);
  }

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onToggleExpand} className={CARD}>
      <View className="flex-row items-center gap-3">
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
        <Text className="text-base text-muted">{expanded ? "︿" : "﹀"}</Text>
      </View>

      {expanded ? (
        <View className="mt-4 gap-3 border-t border-border pt-4">
          <Text className="text-xs font-bold uppercase tracking-wide text-accent">
            Focus : {session.focus}
          </Text>
          {session.exercises.map((exercise, i) => (
            <View key={i} className="flex-row items-start gap-2">
              <Text className="text-sm text-muted">•</Text>
              <Text className="flex-1 text-sm text-text">{exercise}</Text>
            </View>
          ))}
          <TouchableOpacity
            onPress={onToggleDone}
            activeOpacity={0.85}
            className={`mt-1 items-center rounded-full p-3 ${done ? "border border-border" : "bg-primary"}`}
          >
            <Text className={`text-sm font-bold ${done ? "text-muted" : "text-on-primary"}`}>
              {done ? "Marquer comme à faire" : "Marquer comme fait ✓"}
            </Text>
          </TouchableOpacity>

          {done ? (
            <View className="gap-3 border-t border-border pt-3">
              {editingDebrief ? (
                <>
                  <Text className="text-xs font-bold uppercase tracking-wide text-accent">
                    Comment ça s'est passé ?
                  </Text>
                  <View className="flex-row gap-2">
                    {(Object.entries(MOOD_META) as [Mood, { emoji: string; label: string }][]).map(
                      ([mood, meta]) => (
                        <TouchableOpacity
                          key={mood}
                          onPress={() => setDraftMood(mood)}
                          activeOpacity={0.8}
                          className={`flex-1 items-center gap-1 rounded-card border p-2.5 ${
                            draftMood === mood ? "border-primary bg-highlight" : "border-border bg-surface"
                          }`}
                        >
                          <Text className="text-xl">{meta.emoji}</Text>
                          <Text
                            className={`text-xs font-semibold ${
                              draftMood === mood ? "text-primary" : "text-muted"
                            }`}
                          >
                            {meta.label}
                          </Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                  <TextInput
                    className="rounded-card border border-border bg-surface p-3 text-sm text-text"
                    placeholder="Ce qui s'est bien passé, ce qu'on peut améliorer…"
                    value={draftNote}
                    onChangeText={setDraftNote}
                    multiline
                    numberOfLines={3}
                  />
                  <TouchableOpacity
                    onPress={handleSaveDebrief}
                    disabled={!draftMood}
                    activeOpacity={0.85}
                    className={`items-center rounded-full p-3 ${draftMood ? "bg-primary" : "border border-border"}`}
                  >
                    <Text className={`text-sm font-bold ${draftMood ? "text-on-primary" : "text-muted"}`}>
                      Enregistrer
                    </Text>
                  </TouchableOpacity>
                </>
              ) : debrief ? (
                <TouchableOpacity onPress={() => setEditingDebrief(true)} activeOpacity={0.7} className="gap-1.5">
                  <Text className="text-xs font-bold uppercase tracking-wide text-accent">
                    {MOOD_META[debrief.mood].emoji} Ressenti : {MOOD_META[debrief.mood].label}
                  </Text>
                  {debrief.note ? <Text className="text-sm text-text">{debrief.note}</Text> : null}
                  <Text className="text-xs font-semibold text-accent">Modifier</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => setEditingDebrief(true)} activeOpacity={0.7}>
                  <Text className="text-sm font-semibold text-accent">+ Ajouter mon ressenti</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export default function PlanningScreen() {
  const { isDone, toggleSession, completedCount, getDebrief, saveDebrief } = useProgress();
  const [selectedWeek, setSelectedWeek] = useState(CURRENT_WEEK_NUMBER);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const today = new Date();
  const progressPct = Math.round((completedCount / ALL_SESSIONS.length) * 100);

  const weekDates = getWeekDates(selectedWeek);
  const weekSessions = PROGRAM_WEEKS.find((w) => w.weekNumber === selectedWeek)?.sessions ?? [];
  const weekTotalMin = weekSessions.reduce((sum, s) => sum + s.durationMin, 0);
  const visibleSessions =
    selectedDay === null ? weekSessions : weekSessions.filter((s) => s.dayIndex === selectedDay);

  return (
    <Screen>
      <FadeInView>
        <Text className="text-3xl font-extrabold tracking-tight text-text">Planning</Text>
      </FadeInView>

      <FadeInView delay={60}>
        <View className={`${CARD} gap-3`}>
          <View className="gap-1">
            <Text className="text-sm font-bold uppercase tracking-wide text-accent">
              🎯 {PROGRAM.title}
            </Text>
            <Text className="text-sm text-muted">{PROGRAM.theme}</Text>
          </View>

          <View className="gap-1.5">
            <ProgressBar step={completedCount} total={ALL_SESSIONS.length} />
            <Text className="text-sm font-semibold text-text">{progressPct}% du programme complété</Text>
          </View>

          <View className="flex-row justify-between border-t border-border pt-3">
            <View className="items-center gap-0.5">
              <Text className="text-base font-extrabold text-text">
                {CURRENT_WEEK_NUMBER}/{PROGRAM.totalWeeks}
              </Text>
              <Text className="text-xs text-muted">Semaine</Text>
            </View>
            <View className="items-center gap-0.5">
              <Text className="text-base font-extrabold text-text">{SESSION_TEMPLATES.length}</Text>
              <Text className="text-xs text-muted">Séances/sem</Text>
            </View>
            <View className="items-center gap-0.5">
              <Text className="text-base font-extrabold text-text">{PROGRAM.totalWeeks} sem.</Text>
              <Text className="text-xs text-muted">Durée totale</Text>
            </View>
          </View>
        </View>
      </FadeInView>

      <FadeInView delay={120}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-2">
          {PROGRAM_WEEKS.map((week) => {
            const weekDone = week.sessions.every((s) => isDone(s.id));
            const isSelected = week.weekNumber === selectedWeek;
            const isCurrent = week.weekNumber === CURRENT_WEEK_NUMBER;
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
              expanded={expandedId === session.id}
              done={isDone(session.id)}
              debrief={getDebrief(session.id)}
              onToggleExpand={() => setExpandedId(expandedId === session.id ? null : session.id)}
              onToggleDone={() => toggleSession(session.id)}
              onSaveDebrief={(debrief) => saveDebrief(session.id, debrief)}
            />
          </FadeInView>
        ))
      )}
    </Screen>
  );
}
