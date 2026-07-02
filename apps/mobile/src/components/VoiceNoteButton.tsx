import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, Text, TouchableOpacity } from "react-native";
import { Audio } from "expo-av";
import { supabase } from "@/lib/supabase";

type RecordingState = "idle" | "recording" | "processing";

type Props = {
  /** Appelé avec le texte transcrit à la fin — à toi d'ajouter aux notes. */
  onTranscription: (text: string) => void;
};

/** Durée max d'enregistrement : 90 secondes — largement suffisant pour une
 * note post-séance dictée, sans risquer un fichier audio trop lourd. */
const MAX_RECORD_MS = 90_000;

export function VoiceNoteButton({ onTranscription }: Props) {
  const [state, setState] = useState<RecordingState>("idle");
  const recordingRef = useRef<Audio.Recording | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animation de pulsation pendant l'enregistrement
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (state === "recording") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.25, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(1);
    }
  }, [state, pulse]);

  async function startRecording() {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Micro non autorisé",
        "Autorise l'accès au microphone dans les Réglages pour dicter tes notes."
      );
      return;
    }

    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    recordingRef.current = recording;
    setState("recording");

    // Arrêt automatique après MAX_RECORD_MS
    autoStopRef.current = setTimeout(stopAndTranscribe, MAX_RECORD_MS);
  }

  async function stopAndTranscribe() {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    const recording = recordingRef.current;
    if (!recording) return;

    setState("processing");
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error("URI manquant");

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Non connecté");

      const formData = new FormData();
      formData.append("audio", { uri, type: "audio/m4a", name: "note.m4a" } as never);

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/transcribe`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { text } = await res.json() as { text: string };

      if (text) onTranscription(text);
    } catch (e) {
      console.warn("[VoiceNoteButton] erreur", e);
      Alert.alert("Transcription impossible", "Vérifie ta connexion et réessaie.");
    } finally {
      setState("idle");
    }
  }

  function handlePress() {
    if (state === "idle") startRecording();
    else if (state === "recording") stopAndTranscribe();
    // "processing" → bouton désactivé
  }

  const label =
    state === "recording" ? "⏹ Stop" :
    state === "processing" ? "…" :
    "🎙";

  return (
    <Animated.View style={{ transform: [{ scale: state === "recording" ? pulse : 1 }] }}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={state === "processing"}
        activeOpacity={0.75}
        className={`items-center justify-center rounded-full px-3 py-2 ${
          state === "recording"
            ? "bg-red-500"
            : state === "processing"
            ? "bg-border"
            : "bg-accent/15"
        }`}
      >
        <Text
          className={`text-sm font-bold ${
            state === "recording" ? "text-white" : "text-accent"
          }`}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
