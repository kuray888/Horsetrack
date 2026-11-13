import { Alert } from "react-native";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { runNativeInteraction } from "@/lib/nativeInteraction";
import { track } from "@/lib/analytics";
import { buildGpx, gpxFileName } from "@/rides/gpx";
import { decodePolyline } from "@/rides/rideMath";
import type { SessionRide } from "@/rides/types";
import { t } from "@/i18n";

/** Écrit le tracé en GPX dans le cache et ouvre la feuille de partage (Fichiers, Strava…). */
export async function exportRideGpx(ride: SessionRide, name: string): Promise<void> {
  try {
    const route = ride.route ? decodePolyline(ride.route) : [];
    if (route.length < 2) {
      Alert.alert(t("Export impossible"), t("Cette séance n'a pas de tracé GPS."));
      return;
    }
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert(t("Partage indisponible"), t("Le partage de fichiers n'est pas disponible sur cet appareil."));
      return;
    }
    const file = new File(Paths.cache, gpxFileName(name, ride.startedAt));
    if (file.exists) file.delete();
    file.create();
    file.write(buildGpx({ name, startedAt: ride.startedAt, endedAt: ride.endedAt, route }));
    await runNativeInteraction(() => Sharing.shareAsync(file.uri, { mimeType: "application/gpx+xml", UTI: "com.topografix.gpx" }));
    track("ride_gpx_exported", { points: route.length });
  } catch (e) {
    if (__DEV__) console.warn("[gpx] export échoué", e);
    Alert.alert(t("Export impossible"), t("Le fichier n'a pas pu être créé. Réessaie dans un instant."));
  }
}
