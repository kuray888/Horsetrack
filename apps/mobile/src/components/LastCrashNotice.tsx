import { useEffect } from "react";
import { Alert } from "react-native";
import { clearLastCrash, getLastCrash } from "@/lib/crashLog";

/**
 * Affiche une seule fois, au lancement, le dernier plantage JS enregistré
 * localement (cf. lib/crashLog.ts) — filet de diagnostic en l'absence de
 * Sentry configuré. Purement informatif (aucune donnée envoyée nulle part) :
 * permet à un testeur de nous communiquer le contenu par capture d'écran.
 * Efface l'enregistrement après affichage pour ne pas le re-montrer au
 * lancement suivant.
 */
export function LastCrashNotice() {
  useEffect(() => {
    getLastCrash().then((crash) => {
      if (!crash) return;
      Alert.alert(
        "Dernier plantage détecté",
        `${crash.isFatal ? "Fatal" : "Rendu"} · ${new Date(crash.at).toLocaleString("fr-FR")}\n\n${crash.message}`,
        [{ text: "OK", onPress: () => clearLastCrash() }]
      );
    });
  }, []);

  return null;
}
