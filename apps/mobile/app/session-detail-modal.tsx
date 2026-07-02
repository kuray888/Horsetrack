import { useEffect, useRef, useState } from "react";
import { Animated, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useProgram } from "@/program/store";
import { useProgress, type Mood } from "@/progress/store";
import type { SessionIntensity, SessionStepPhase } from "@/program/types";
import { WEEK_DAYS_FULL } from "@/lib/dateFormat";
import { usePressScale } from "@/hooks/usePressScale";
import { GlossaryText } from "@/components/GlossaryText";
import { GlossaryPopup } from "@/glossary/GlossaryProvider";

const CARD = "rounded-card bg-surface p-5 shadow-card";

const PHASE_LABELS: Record<SessionStepPhase, string> = {
  ECHAUFFEMENT: "Échauffement",
  CORPS_DE_SEANCE: "Corps de séance",
  RETOUR_AU_CALME: "Retour au calme",
};

const PHASE_ORDER: SessionStepPhase[] = ["ECHAUFFEMENT", "CORPS_DE_SEANCE", "RETOUR_AU_CALME"];

const INTENSITY_META: Record<SessionIntensity, { emoji: string; label: string }> = {
  LOW: { emoji: "🟢", label: "Légère" },
  MEDIUM: { emoji: "🟡", label: "Modérée" },
  HIGH: { emoji: "🔴", label: "Intense" },
};

const MOOD_META: Record<Mood, { emoji: string; label: string }> = {
  great: { emoji: "🤩", label: "Top" },
  good: { emoji: "🙂", label: "Bien" },
  okay: { emoji: "😐", label: "Moyen" },
  hard: { emoji: "😣", label: "Difficile" },
};

export default function SessionDetailModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { allSessions } = useProgram();
  const { isDone, toggleSession, getDebrief, saveDebrief } = useProgress();

  const session = allSessions.find((s) => s.id === id);
  const done = session ? isDone(session.id) : false;

  const [editingDebrief, setEditingDebrief] = useState(false);
  const debrief = session ? getDebrief(session.id) : null;
  const [draftMood, setDraftMood] = useState<Mood | null>(debrief?.mood ?? null);
  const [draftNote, setDraftNote] = useState(debrief?.note ?? "");

  const { scale: pressScale, onPressIn, onPressOut } = usePressScale();
  const popScale = useRef(new Animated.Value(1)).current;
  const wasDone = useRef(done);

  // Petit rebond satisfaisant uniquement au moment où la séance passe à "faite"
  // (pas au montage si elle l'était déjà).
  useEffect(() => {
    if (done && !wasDone.current) {
      popScale.setValue(0.8);
      Animated.spring(popScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 16 }).start();
    }
    wasDone.current = done;
  }, [done, popScale]);

  if (!session) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="text-base text-muted">Séance introuvable.</Text>
      </SafeAreaView>
    );
  }

  const sessionId = session.id;
  const intensity = INTENSITY_META[session.intensity];

  function handleSaveDebrief() {
    if (!draftMood) return;
    saveDebrief(sessionId, { mood: draftMood, note: draftNote.trim() });
    setEditingDebrief(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView contentContainerClassName="gap-4 p-5" showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={8} className="self-start">
          <Text className="text-sm font-semibold text-accent">‹ Retour</Text>
        </TouchableOpacity>

        <View className={`${CARD} gap-2`}>
          <Text className="text-2xl font-extrabold tracking-tight text-text">{session.title}</Text>
          <Text className="text-sm text-muted">
            {WEEK_DAYS_FULL[session.dayIndex]} · {session.time} · {session.durationMin} min
          </Text>
          <View className="flex-row items-center gap-3 border-t border-border pt-3">
            <Text className="text-sm font-semibold text-text">
              {intensity.emoji} Intensité {intensity.label}
            </Text>
            <Text className="text-sm text-muted">·</Text>
            <Text className="text-sm font-semibold text-text">🎯 {session.focus}</Text>
          </View>
        </View>

        {!done ? (
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/session-active-modal", params: { id: sessionId } })}
            activeOpacity={0.85}
            className="items-center rounded-full bg-primary py-4"
          >
            <Text className="text-base font-bold text-on-primary">▶  Commencer la séance</Text>
          </TouchableOpacity>
        ) : null}

        <View className={`${CARD} gap-2`}>
          <Text className="text-sm font-bold uppercase tracking-wide text-accent">Matériel nécessaire</Text>
          {session.equipment.map((item, i) => (
            <View key={i} className="flex-row items-start gap-2">
              <Text className="text-sm text-muted">•</Text>
              <View className="flex-1">
                <GlossaryText text={item} className="text-sm text-text" />
              </View>
            </View>
          ))}
        </View>

        {session.setupNotes.length > 0 ? (
          <View className={`${CARD} gap-2`}>
            <Text className="text-sm font-bold uppercase tracking-wide text-accent">Repères techniques</Text>
            {session.setupNotes.map((note, i) => (
              <View key={i} className="flex-row items-start gap-2">
                <Text className="text-sm text-muted">📏</Text>
                <View className="flex-1">
                  <GlossaryText text={note} className="text-sm text-text" />
                </View>
              </View>
            ))}
            <Text className="text-xs text-muted">
              Points de départ à ajuster au ressenti — pas des prescriptions strictes.
            </Text>
          </View>
        ) : null}

        {PHASE_ORDER.map((phase) => {
          const steps = session.exercises.filter((e) => e.phase === phase);
          if (steps.length === 0) return null;
          return (
            <View key={phase} className={`${CARD} gap-3`}>
              <Text className="text-sm font-bold uppercase tracking-wide text-accent">{PHASE_LABELS[phase]}</Text>
              {steps.map((step, i) => (
                <View key={i} className="gap-1">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="flex-1 text-sm font-bold text-text">{step.title}</Text>
                    <Text className="text-xs font-bold text-accent">{step.durationMin} min</Text>
                  </View>
                  <GlossaryText text={step.description} className="text-sm leading-5 text-muted" />
                </View>
              ))}
            </View>
          );
        })}

        <Animated.View style={{ transform: [{ scale: Animated.multiply(pressScale, popScale) }] }}>
          <TouchableOpacity
            onPress={() => toggleSession(sessionId)}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            activeOpacity={0.85}
            className={`items-center rounded-full p-3 ${done ? "border border-border" : "bg-primary"}`}
          >
            <Text className={`text-sm font-bold ${done ? "text-muted" : "text-on-primary"}`}>
              {done ? "Marquer comme à faire" : "Marquer comme fait ✓"}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {done ? (
          <View className={`${CARD} gap-3`}>
            {editingDebrief ? (
              <>
                <Text className="text-xs font-bold uppercase tracking-wide text-accent">Comment ça s&apos;est passé ?</Text>
                <View className="flex-row gap-2">
                  {(Object.entries(MOOD_META) as [Mood, { emoji: string; label: string }][]).map(([mood, meta]) => (
                    <TouchableOpacity
                      key={mood}
                      onPress={() => setDraftMood(mood)}
                      activeOpacity={0.8}
                      className={`flex-1 items-center gap-1 rounded-card border p-2.5 ${
                        draftMood === mood ? "border-primary bg-highlight" : "border-border bg-surface"
                      }`}
                    >
                      <Text className="text-xl">{meta.emoji}</Text>
                      <Text className={`text-xs font-semibold ${draftMood === mood ? "text-primary" : "text-muted"}`}>
                        {meta.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
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
            ) : debrief && MOOD_META[debrief.mood] ? (
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
      </ScrollView>
      <GlossaryPopup />
    </SafeAreaView>
  );
}
