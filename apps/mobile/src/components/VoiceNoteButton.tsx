import { Text, View } from "react-native";

type Props = {
  onTranscription: (text: string) => void;
};

/**
 * Dictée vocale — temporairement désactivée le temps qu'expo-speech-recognition
 * publie une version compatible avec Expo SDK 57.
 */
export function VoiceNoteButton(_props: Props) {
  return (
    <View className="items-end">
      <View className="flex-row items-center gap-1.5 rounded-full bg-border px-3 py-1.5 opacity-40">
        <Text className="text-sm text-muted">🎙</Text>
        <Text className="text-xs font-semibold text-muted">Dicter</Text>
      </View>
    </View>
  );
}
