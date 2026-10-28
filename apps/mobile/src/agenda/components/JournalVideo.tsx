import { Text, View } from "react-native";
import { t } from "@/i18n";

/**
 * Module natif chargé à la demande : sur un client compilé sans lui (ancien
 * client de développement), importer « expo-video » en tête de fichier faisait
 * planter l'app dès son ouverture — la carte du journal est chargée au
 * démarrage. Même précaution que lib/haptics.ts.
 */
type VideoModule = typeof import("expo-video");
let videoModule: VideoModule | null | undefined;

function loadVideo(): VideoModule | null {
  if (videoModule === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      videoModule = require("expo-video") as VideoModule;
    } catch {
      videoModule = null;
    }
  }
  return videoModule;
}

/** Lecteur de la vidéo d'un souvenir : commandes natives, jamais de lecture
 * automatique. */
export function JournalVideo({ uri, height }: { uri: string; height: number }) {
  const mod = loadVideo();
  if (!mod) {
    return (
      <View className="items-center justify-center rounded-card bg-border/40" style={{ height }}>
        <Text className="text-sm text-muted">{t("Vidéo lisible après la mise à jour de l'app.")}</Text>
      </View>
    );
  }
  return <Player mod={mod} uri={uri} height={height} />;
}

function Player({ mod, uri, height }: { mod: VideoModule; uri: string; height: number }) {
  const player = mod.useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  const { VideoView } = mod;
  return (
    <View className="overflow-hidden rounded-card bg-black" style={{ height }} accessibilityLabel={t("Vidéo du souvenir")}>
      <VideoView player={player} style={{ width: "100%", height }} contentFit="contain" nativeControls />
    </View>
  );
}
