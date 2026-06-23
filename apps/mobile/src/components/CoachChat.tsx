import { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FadeInView } from "@/components/FadeInView";
import { askCoach, CoachError, type CoachHistoryEntry } from "@/lib/coach";
import { useHorses } from "@/horses/store";
import { useRiderProfile } from "@/rider/store";
import { DISCIPLINES, HORSE_LEVELS, RIDER_LEVELS, RIDER_GOALS } from "@/onboarding/options";

type Message = { id: string; role: "user" | "coach"; text: string };

const SUGGESTIONS = [
  { icon: "💡", text: "Un conseil pour la prochaine séance" },
  { icon: "🏆", text: "Comment progresser en concours ?" },
  { icon: "😴", text: "Mon cheval semble fatigué, que faire ?" },
  { icon: "😰", text: "Gérer le stress avant un concours" },
];

function labelOf<T extends string>(
  options: { value: T; label: string }[],
  value: T | null | undefined
): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? value;
}

function TypingDots() {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];

  useEffect(() => {
    const loops = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot, { toValue: 1, duration: 350, delay: i * 150, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 350, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <View className="flex-row gap-1.5 px-1 py-1.5">
      {dots.map((dot, i) => (
        <Animated.View key={i} style={{ opacity: dot }} className="h-2 w-2 rounded-full bg-muted" />
      ))}
    </View>
  );
}

function Avatar() {
  return (
    <View className="h-7 w-7 items-center justify-center rounded-full bg-highlight">
      <Text className="text-xs">🐴</Text>
    </View>
  );
}

/** Chat avec le coach IA — réutilisé par l'onglet Coach et la bulle flottante (modal). */
export function CoachChat({ onClose }: { onClose?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { horses } = useHorses();
  const { riderProfile } = useRiderProfile();

  const primaryHorse = horses.find((h) => h.isPrimary) ?? horses[0];
  const horseName = primaryHorse?.name?.trim() || "ton cheval";
  const greeting = `Pose-moi une question sur l'entraînement, la santé ou la progression de ${horseName} — je suis là pour t'aider.`;

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || typing) return;
    const history: CoachHistoryEntry[] = messages.slice(-20).map((m) => ({
      role: m.role === "coach" ? "assistant" : "user",
      text: m.text,
    }));
    setMessages((m) => [...m, { id: String(Date.now()), role: "user", text: trimmed }]);
    setInput("");
    setTyping(true);
    try {
      const reply = await askCoach(trimmed, history, {
        horseName,
        discipline: labelOf(DISCIPLINES, primaryHorse?.discipline),
        horseLevel: labelOf(HORSE_LEVELS, primaryHorse?.level),
        strengths: primaryHorse?.strengths ?? [],
        weaknesses: primaryHorse?.weaknesses ?? [],
        riderLevel: labelOf(RIDER_LEVELS, riderProfile.level),
        riderGoal: labelOf(RIDER_GOALS, riderProfile.primaryGoal),
        additionalInfo: riderProfile.additionalInfo,
      });
      setMessages((m) => [...m, { id: String(Date.now() + 1), role: "coach", text: reply }]);
    } catch (e) {
      const text =
        e instanceof CoachError && e.status === 429
          ? "Tu as atteint la limite de messages pour aujourd'hui — reviens demain !"
          : "Désolé, je n'arrive pas à répondre pour l'instant. Réessaie dans un instant.";
      setMessages((m) => [...m, { id: String(Date.now() + 1), role: "coach", text }]);
    } finally {
      setTyping(false);
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, typing]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row items-center gap-3 border-b border-border px-5 pb-3 pt-2">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-highlight">
          <Text className="text-xl">🐴</Text>
        </View>
        <View className="flex-1">
          <Text className="text-base font-extrabold tracking-tight text-text">Coach IA</Text>
          <View className="flex-row items-center gap-1.5">
            <View className="h-1.5 w-1.5 rounded-full bg-success" />
            <Text className="text-xs text-muted">En ligne</Text>
          </View>
        </View>
        {onClose ? (
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text className="text-xl text-muted">✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : "height"}>
        {messages.length === 0 ? (
          <View className="flex-1 justify-center gap-7 px-6">
            <FadeInView>
              <View className="items-center gap-3">
                <View className="h-20 w-20 items-center justify-center rounded-full bg-highlight">
                  <Text className="text-4xl">🐴</Text>
                </View>
                <View className="gap-1.5">
                  <Text className="text-center text-xl font-extrabold tracking-tight text-text">
                    Salut, je suis ton coach
                  </Text>
                  <Text className="text-center text-sm leading-5 text-muted">{greeting}</Text>
                </View>
              </View>
            </FadeInView>

            <View className="gap-3">
              {SUGGESTIONS.map((s, i) => (
                <FadeInView key={s.text} delay={100 + i * 70}>
                  <TouchableOpacity
                    onPress={() => send(s.text)}
                    activeOpacity={0.8}
                    className="flex-row items-center gap-3 rounded-card bg-surface p-4 shadow-card"
                  >
                    <Text className="text-xl">{s.icon}</Text>
                    <Text className="flex-1 text-sm font-semibold text-text">{s.text}</Text>
                    <Text className="text-base text-muted">›</Text>
                  </TouchableOpacity>
                </FadeInView>
              ))}
            </View>
          </View>
        ) : (
          <ScrollView ref={scrollRef} contentContainerClassName="gap-3 p-5" showsVerticalScrollIndicator={false}>
            {messages.map((m) => (
              <FadeInView key={m.id}>
                <View className={`flex-row items-end gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "coach" ? <Avatar /> : null}
                  <View
                    className={`max-w-[78%] rounded-card px-4 py-3 ${
                      m.role === "user" ? "bg-primary" : "bg-surface shadow-card"
                    }`}
                  >
                    <Text className={`text-[15px] leading-5 ${m.role === "user" ? "text-on-primary" : "text-text"}`}>
                      {m.text}
                    </Text>
                  </View>
                </View>
              </FadeInView>
            ))}
            {typing ? (
              <View className="flex-row items-end gap-2">
                <Avatar />
                <View className="rounded-card bg-surface px-3 shadow-card">
                  <TypingDots />
                </View>
              </View>
            ) : null}
          </ScrollView>
        )}

        <View className="flex-row items-center gap-2 border-t border-border px-4 py-3">
          <TextInput
            className="flex-1 rounded-full border border-border bg-surface px-4 py-3 text-base text-text"
            placeholder="Écris à ton coach…"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
          />
          <TouchableOpacity
            onPress={() => send(input)}
            activeOpacity={0.85}
            disabled={!input.trim()}
            className={`h-11 w-11 items-center justify-center rounded-full ${input.trim() ? "bg-primary" : "bg-border"}`}
          >
            <Text className="text-lg text-on-primary">➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
