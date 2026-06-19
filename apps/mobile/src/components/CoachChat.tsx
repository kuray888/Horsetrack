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

type Message = { id: string; role: "user" | "coach"; text: string };

const GREETING =
  "Pose-moi une question sur l'entraînement, la santé ou la progression de Tornado — je suis là pour t'aider.";

const SUGGESTIONS = [
  { icon: "💡", text: "Un conseil pour la prochaine séance" },
  { icon: "🏆", text: "Comment progresser en concours ?" },
  { icon: "😴", text: "Tornado semble fatigué, que faire ?" },
  { icon: "😰", text: "Gérer le stress avant un concours" },
];

const FALLBACK_REPLIES = [
  "Bonne question. Avec le niveau actuel de Tornado, mieux vaut consolider que brûler les étapes — la régularité paie toujours plus que l'intensité.",
  "Je dirais d'ajouter un peu de travail à pied cette semaine : c'est souvent ce qui renforce le plus la complicité.",
  "Pense à varier les terrains et les allures à l'échauffement — ça prépare mieux le corps et l'esprit qu'une routine toujours identique.",
  "Un debrief de deux minutes après chaque séance fait une vraie différence sur la durée : note ce qui a marché, et ce qu'on ajuste la prochaine fois.",
];

/** Réponses mock par mots-clés — à remplacer par un vrai modèle plus tard. */
function mockReply(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("fatigu")) {
    return "Si Tornado semble fatigué, allège la séance du jour : marche en main, étirements doux, et observe sa récupération sur 24 à 48h. Inutile de forcer tant qu'il ne paraît pas frais.";
  }
  if (t.includes("concours") || t.includes("cso") || t.includes("stress")) {
    return "Pour aborder un concours plus serein, travaille la mise en confiance à l'entraînement : reproduis l'ambiance (bruit, public, autres chevaux) et garde toujours la même routine d'échauffement. La régularité rassure.";
  }
  if (t.includes("séance") || t.includes("seance") || t.includes("demain")) {
    return "Pour ta prochaine séance : 10 minutes d'échauffement progressif, un bloc de travail ciblé sur ton objectif du moment, puis un retour au calme. Mieux vaut une séance courte et propre qu'une longue et brouillonne.";
  }
  if (t.includes("progress")) {
    return "Pour progresser, alterne barres au sol, petits sauts techniques et travail à plat. La précision compte plus que la hauteur — construisez d'abord des bases solides.";
  }
  return FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];
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

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || typing) return;
    setMessages((m) => [...m, { id: String(Date.now()), role: "user", text: trimmed }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setMessages((m) => [...m, { id: String(Date.now() + 1), role: "coach", text: mockReply(trimmed) }]);
      setTyping(false);
    }, 900);
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
                  <Text className="text-center text-sm leading-5 text-muted">{GREETING}</Text>
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
