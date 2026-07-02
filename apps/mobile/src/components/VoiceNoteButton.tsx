import { useRef, useState } from "react";
import { Alert, Animated, Easing, Text, TouchableOpacity, View } from "react-native";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

type Props = {
  /** Appelé avec le texte transcrit final — à concaténer aux notes existantes. */
  onTranscription: (text: string) => void;
};

/**
 * Bouton de dictée vocale — utilise la reconnaissance vocale native de l'appareil
 * (SFSpeechRecognizer sur iOS, SpeechRecognizer sur Android). Aucun service
 * externe : la transcription est faite par le système ou les serveurs Apple/Google,
 * pas par une API tierce payante.
 *
 * Mode continuous pour que les pauses naturelles entre les phrases ne stoppent
 * pas l'enregistrement — l'utilisateur arrête lui-même via le bouton ⏹.
 * Chaque segment final est collecté et joint en un seul texte à la fin.
 */
export function VoiceNoteButton({ onTranscription }: Props) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");

  // Collecte tous les segments finaux (continuous mode → plusieurs résultats finaux)
  const segmentsRef = useRef<string[]>([]);

  // Animation de pulsation pendant l'écoute
  const pulse = useRef(new Animated.Value(1)).current;

  function startPulse() {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.2, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }

  function stopPulse() {
    pulse.stopAnimation();
    pulse.setValue(1);
  }

  // ── Événements de reconnaissance ──────────────────────────────────────────

  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript ?? "";
    if (event.isFinal) {
      // Segment terminé → on le stocke, on efface l'aperçu
      if (text) segmentsRef.current.push(text);
      setInterim("");
    } else {
      // Résultat partiel → aperçu en direct
      setInterim(text);
    }
  });

  useSpeechRecognitionEvent("end", () => {
    stopPulse();
    setListening(false);
    setInterim("");

    const full = segmentsRef.current.join(" ").trim();
    segmentsRef.current = [];

    if (full) onTranscription(full);
  });

  useSpeechRecognitionEvent("error", (event) => {
    stopPulse();
    setListening(false);
    setInterim("");
    segmentsRef.current = [];

    // "no-speech" et "aborted" sont des arrêts normaux, pas des erreurs à afficher
    if (event.error !== "no-speech" && event.error !== "aborted") {
      Alert.alert("Reconnaissance vocale", "Impossible de comprendre. Vérifie ta connexion et réessaie.");
    }
  });

  // ── Contrôles ─────────────────────────────────────────────────────────────

  async function start() {
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      Alert.alert(
        "Micro non autorisé",
        "Autorise l'accès au microphone dans les Réglages pour dicter tes notes."
      );
      return;
    }

    segmentsRef.current = [];
    setInterim("");
    setListening(true);
    startPulse();

    ExpoSpeechRecognitionModule.start({
      lang: "fr-FR",
      interimResults: true,
      maxAlternatives: 1,
      continuous: true, // les pauses ne stoppent pas l'écoute
      requiresOnDeviceRecognition: false, // utilise les serveurs Apple/Google pour meilleure précision
    });
  }

  function stop() {
    ExpoSpeechRecognitionModule.stop();
    // L'événement "end" gère la suite
  }

  function handlePress() {
    if (listening) stop();
    else start();
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <View className="items-end gap-1">
      {/* Aperçu du texte en cours de dictée */}
      {interim ? (
        <Text className="max-w-[200px] text-right text-xs italic text-muted" numberOfLines={2}>
          {interim}
        </Text>
      ) : null}

      <Animated.View style={{ transform: [{ scale: listening ? pulse : 1 }] }}>
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.75}
          className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${
            listening ? "bg-red-500" : "bg-accent/15"
          }`}
        >
          <Text className={`text-sm ${listening ? "text-white" : "text-accent"}`}>
            {listening ? "⏹" : "🎙"}
          </Text>
          <Text className={`text-xs font-semibold ${listening ? "text-white" : "text-accent"}`}>
            {listening ? "Stop" : "Dicter"}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
