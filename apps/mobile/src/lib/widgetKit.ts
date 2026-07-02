import { Platform } from "react-native";

const APP_GROUP = "group.com.horsetrack.app";
const WIDGET_KEY = "widgetData";

export type WidgetData = {
  horseName: string;
  todaySessionTitle: string | null;
  todaySessionDurationMin: number | null;
  todaySessionTime: string | null;
  weeklyDone: number;
  weeklyTotal: number;
};

/**
 * Pousse les données vers le widget iOS via l'App Group UserDefaults partagé,
 * puis déclenche un rechargement immédiat de la timeline.
 * Best-effort : un échec ne doit jamais bloquer l'app.
 */
export async function pushWidgetData(data: WidgetData): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SharedGroupPreferences = require("react-native-shared-group-preferences").default;
    await SharedGroupPreferences.setItem(WIDGET_KEY, JSON.stringify(data), APP_GROUP);
  } catch {
    // Le module natif n'est pas disponible (Expo Go, simulateur sans widget,
    // ou build sans l'extension). Silencieux — le widget restera sur ses
    // données précédentes ou sur le placeholder.
  }
}
