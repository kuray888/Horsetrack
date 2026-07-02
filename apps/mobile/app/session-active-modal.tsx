import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { useProgram } from "@/program/store";
import { useProgress, type Mood } from "@/progress/store";
import type { SessionStepPhase } from "@/program/types";

// ─── Constantes d'affichage ──────────────────────────────────────────────────

const PHASE_LABELS: Record<SessionStepPhase, string> = {
  ECHAUFFEMENT: "Échauffement",
  CORPS_DE_SEANCE: "Corps de séance",
  RETOUR_AU_CALME: "Retour au calme",
};

const PHASE_BG: Record<SessionStepPhase, string> = {
  ECHAUFFEMENT: "bg-warning/20",
  CORPS_DE_SEANCE: "bg-primary/15",
  RETOUR_AU_CALME: "bg-success/15",
};

const PHASE_TEXT: Record<SessionStepPhase, string> = {
  ECHAUFFEMENT: "text-warning",
  CORPS_DE_SEANCE: "text-primary",
  RETOUR_AU_CALME: "text-success",
};

const MOOD_META: Record<Mood, { emoji: string; label: string }> = {
  great: { emoji: "🤩", label: "Top" },
  good: { emoji: "🙂", label: "Bien" },
  okay: { emoji: "😐", label: "Moyen" },
  hard: { emoji: "😣", label: "Difficile" },
};

const MOOD_ENTRIES = Object.entries(MOOD_META) as [Mood, { emoji: string; label: string }][];

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Composant ───────────────────────────────────────────────────────────────

export default function SessionActiveModal() {
  useKeepAwake();

  const { id } = useLocalSearchParams<{ id: string }>();
  const { allSessions } = useProgram();
  const { isDone, toggleSession, saveDebrief } = useProgress();

  const session = allSessions.find((s) => s.id === id);
  const exercises = session?.exercises ?? [];
  const sessionId = session?.id ?? "";

  // Normalise les durées d'exercice pour que leur somme corresponde exactement
  // à session.durationMin. Deux sources de décalage possibles :
  //   1. Exercice bonus (5e étape) : les 5 parts somment à 1.15 × la durée totale
  //   2. Adaptations adaptatives (véto, canicule, feedback) : session.durationMin
  //      est rescalé dans program/store sans que exercises[i].durationMin le soit
  // useMemo garantit une référence stable → pas de re-inscription inutile de l'effet
  // d'auto-avance à chaque render.
  const exerciseSeconds = useMemo(() => {
    const rawTotal = exercises.reduce((s, e) => s + e.durationMin, 0);
    const sessMin = session?.durationMin ?? rawTotal;
    return exercises.map((e) =>
      rawTotal > 0 ? Math.max(60, Math.round((e.durationMin / rawTotal) * sessMin * 60)) : 300
    );
  }, [exercises, session?.durationMin]);

  // ── État du timer ──────────────────────────────────────────────────────────
  const [stepIndex, setStepIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(() => exerciseSeconds[0] ?? 300);
  const [isPaused, setIsPaused] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [totalElapsed, setTotalElapsed] = useState(0);

  // ── État du débrief (écran de fin) ─────────────────────────────────────────
  const [draftMood, setDraftMood] = useState<Mood | null>(null);
  const [draftNote, setDraftNote] = useState("");

  // ── Countdown : décrémente chaque seconde ─────────────────────────────────
  useEffect(() => {
    if (isPaused || isComplete) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
      setTotalElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [isPaused, isComplete]);

  // ── Auto-avance quand le timer arrive à 0 ─────────────────────────────────
  useEffect(() => {
    if (secondsLeft !== 0 || isPaused || isComplete) return;
    const next = stepIndex + 1;
    if (next >= exercises.length) {
      setIsComplete(true);
      return;
    }
    setStepIndex(next);
    setSecondsLeft(exerciseSeconds[next] ?? 300);
  }, [secondsLeft, isPaused, isComplete, stepIndex, exerciseSeconds]);

  // ── Navigation inter-exercices ────────────────────────────────────────────
  function goToStep(index: number) {
    setStepIndex(index);
    setSecondsLeft(exerciseSeconds[index] ?? 300);
  }

  function handlePrev() {
    if (stepIndex > 0) goToStep(stepIndex - 1);
  }

  function handleNext() {
    if (stepIndex < exercises.length - 1) {
      goToStep(stepIndex + 1);
    } else {
      setIsComplete(true);
    }
  }

  // ── Quitter avec confirmation si le timer tourne ───────────────────────────
  function handleClose() {
    if (isComplete) { router.back(); return; }
    setIsPaused(true);
    Alert.alert(
      "Quitter la séance ?",
      "Le minuteur sera arrêté et la séance ne sera pas marquée comme faite.",
      [
        { text: "Continuer la séance", style: "cancel", onPress: () => setIsPaused(false) },
        { text: "Quitter", style: "destructive", onPress: () => router.back() },
      ]
    );
  }

  // ── Terminer manuellement avant la fin ────────────────────────────────────
  function handleFinishEarly() {
    setIsComplete(true);
  }

  // ── Valider la séance + débrief depuis l'écran de fin ─────────────────────
  function handleComplete() {
    if (!isDone(sessionId)) toggleSession(sessionId);
    if (draftMood) saveDebrief(sessionId, { mood: draftMood, note: draftNote.trim() });
    router.back();
  }

  // ── Garde : séance introuvable ────────────────────────────────────────────
  if (!session || exercises.length === 0) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="text-base text-muted">Séance introuvable.</Text>
      </SafeAreaView>
    );
  }

  const step = exercises[stepIndex];
  const progress = (stepIndex + 1) / exercises.length;

  // ═════════════════════════════════════════════════════════════════════════
  // ÉCRAN DE FIN : résumé + débrief
  // ═════════════════════════════════════════════════════════════════════════
  if (isComplete) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <ScrollView
          contentContainerClassName="items-center gap-6 px-6 py-10"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Succès */}
          <Text style={{ fontSize: 64 }}>✅</Text>
          <View className="items-center gap-1">
            <Text className="text-2xl font-extrabold tracking-tight text-text">
              Séance terminée !
            </Text>
            <Text className="text-sm text-muted">
              {formatTime(totalElapsed)} · {exercises.length} exercice{exercises.length > 1 ? "s" : ""}
            </Text>
          </View>

          {/* Débrief */}
          <View className="w-full gap-3 rounded-card bg-surface p-5 shadow-card">
            <Text className="text-xs font-bold uppercase tracking-wide text-accent">
              Comment ça s&apos;est passé ?
            </Text>
            <View className="flex-row gap-2">
              {MOOD_ENTRIES.map(([mood, meta]) => (
                <TouchableOpacity
                  key={mood}
                  onPress={() => setDraftMood(mood)}
                  activeOpacity={0.8}
                  className={`flex-1 items-center gap-1 rounded-card border p-2.5 ${
                    draftMood === mood ? "border-primary bg-highlight" : "border-border"
                  }`}
                >
                  <Text className="text-xl">{meta.emoji}</Text>
                  <Text
                    className={`text-xs font-semibold ${draftMood === mood ? "text-primary" : "text-muted"}`}
                  >
                    {meta.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              className="rounded-card border border-border bg-background p-3 text-sm text-text"
              placeholder="Note optionnelle — ce qui s'est bien passé, à travailler…"
              value={draftNote}
              onChangeText={setDraftNote}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Actions */}
          <View className="w-full gap-3">
            <TouchableOpacity
              onPress={handleComplete}
              activeOpacity={0.85}
              className="items-center rounded-full bg-primary py-4"
            >
              <Text className="text-base font-bold text-on-primary">
                {draftMood ? "Enregistrer et marquer comme faite ✓" : "Marquer comme faite ✓"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} className="items-center py-2">
              <Text className="text-sm font-semibold text-muted">Retour à la fiche sans marquer</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ÉCRAN DU TIMER
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {/* Barre du haut */}
      <View className="flex-row items-center justify-between px-5 pt-2">
        <TouchableOpacity onPress={handleClose} hitSlop={12}>
          <Text className="text-xl text-muted">✕</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-center text-sm font-semibold text-muted" numberOfLines={1}>
          {session.title}
        </Text>
        <Text className="text-sm tabular-nums text-muted">{formatTime(totalElapsed)}</Text>
      </View>

      {/* Zone centrale */}
      <View className="flex-1 items-center justify-center gap-5 px-6">
        {/* Badge de phase */}
        <View className={`rounded-full px-4 py-1.5 ${PHASE_BG[step.phase]}`}>
          <Text className={`text-xs font-bold uppercase tracking-widest ${PHASE_TEXT[step.phase]}`}>
            {PHASE_LABELS[step.phase]}
          </Text>
        </View>

        {/* Titre de l'exercice */}
        <Text className="text-center text-2xl font-extrabold tracking-tight text-text" numberOfLines={2}>
          {step.title}
        </Text>

        {/* Description */}
        <Text className="text-center text-sm leading-5 text-muted" numberOfLines={4}>
          {step.description}
        </Text>

        {/* Minuteur */}
        <Text
          style={{ fontSize: 80, fontWeight: "900", fontVariant: ["tabular-nums"], lineHeight: 88 }}
          className={`text-text ${isPaused ? "opacity-40" : ""}`}
        >
          {formatTime(secondsLeft)}
        </Text>

        {/* Barre de progression des exercices */}
        <View className="w-full gap-1.5">
          <View className="h-1.5 overflow-hidden rounded-full bg-border">
            <View
              className="h-full rounded-full bg-primary"
              style={{ width: `${progress * 100}%` }}
            />
          </View>
          <Text className="text-center text-xs text-muted">
            Exercice {stepIndex + 1} / {exercises.length}
          </Text>
        </View>
      </View>

      {/* Contrôles */}
      <View className="gap-3 px-5 pb-4">
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={handlePrev}
            disabled={stepIndex === 0}
            activeOpacity={0.8}
            className={`flex-1 items-center rounded-card border border-border py-4 ${stepIndex === 0 ? "opacity-30" : ""}`}
          >
            <Text className="text-sm font-semibold text-text">‹ Préc.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsPaused((p) => !p)}
            activeOpacity={0.85}
            className="flex-[2] items-center rounded-card bg-primary py-4"
          >
            <Text className="text-base font-bold text-on-primary">
              {isPaused ? "▶  Reprendre" : "⏸  Pause"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleNext}
            activeOpacity={0.8}
            className="flex-1 items-center rounded-card border border-border py-4"
          >
            <Text className="text-sm font-semibold text-text">Suiv. ›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleFinishEarly} activeOpacity={0.7} className="items-center py-2">
          <Text className="text-sm font-semibold text-accent">Terminer la séance</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
