import { Platform } from "react-native";
import { ExtensionStorage } from "@bacons/apple-targets";
import type { WidgetData } from "@/lib/widgetData";

export type { WidgetData } from "@/lib/widgetData";

/** App Group partagé avec la cible widget (cf. app.json → ios.entitlements
 * et targets/horsetrack-widget/expo-target.config.js). */
const APP_GROUP = "group.com.horsetrack.app";
const WIDGET_KEY = "widgetData";
const WIDGET_KIND = "HorsetrackWidget";

let lastPushed: string | null = null;

/**
 * Écrit les données du widget dans l'App Group, puis demande à iOS de le
 * redessiner. Sans effet hors iOS et sur un client de développement compilé
 * sans le module natif : ExtensionStorage retombe alors sur des fonctions
 * vides, rien ne plante.
 *
 * iOS limite le nombre de rafraîchissements d'un widget : on ne le relance
 * que si les données ont vraiment changé (l'Accueil rappelle cette fonction
 * à chaque rendu qui touche ses dépendances).
 */
export async function pushWidgetData(data: WidgetData): Promise<void> {
  if (Platform.OS !== "ios") return;
  const json = JSON.stringify(data);
  if (json === lastPushed) return;
  try {
    new ExtensionStorage(APP_GROUP).set(WIDGET_KEY, json);
    ExtensionStorage.reloadWidget(WIDGET_KIND);
    lastPushed = json;
  } catch (e) {
    console.warn("[widget] mise à jour impossible", e);
  }
}
