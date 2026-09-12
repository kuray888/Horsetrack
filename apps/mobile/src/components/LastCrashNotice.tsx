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
      // Tronquée : une Alert n'affiche confortablement qu'un texte court,
      // et l'essentiel pour diagnostiquer (fichier/fonction) apparaît dans
      // les toutes premières lignes d'une stack Hermes.
      const stackPreview = crash.stack ? `\n\n${crash.stack.slice(0, 600)}` : "";
      Alert.alert(
        "Dernier plantage détecté",
        `${crash.isFatal ? "Fatal" : "Rendu"} · ${new Date(crash.at).toLocaleString("fr-FR")}\n\n${crash.message}${stackPreview}`,
        [{ text: "OK", onPress: () => clearLastCrash() }]
      );
    });
  }, []);

  return null;
}
